//! Task planning and decomposition for AIRIS-CLI.

use airis_core::prelude::*;
use chrono::Utc;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

/// Planner implementation.
pub struct PlannerImpl;

impl PlannerImpl {
    pub fn new() -> Self {
        Self
    }

    /// Detect potential loops in a plan.
    fn detect_loops(steps: &[PlanStep]) -> Vec<Vec<Uuid>> {
        let mut deps: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
        for step in steps {
            deps.entry(step.id).or_default().extend(step.depends_on.clone());
        }

        let mut loops = Vec::new();
        let mut visited = HashSet::new();

        for start_id in deps.keys() {
            if !visited.contains(start_id) {
                let mut path = Vec::new();
                let mut in_path = HashSet::new();
                if dfs_cycle(*start_id, &deps, &mut visited, &mut path, &mut in_path) {
                    loops.push(path.clone());
                }
            }
        }

        loops
    }
}

fn dfs_cycle(
    id: Uuid,
    deps: &HashMap<Uuid, Vec<Uuid>>,
    visited: &mut HashSet<Uuid>,
    path: &mut Vec<Uuid>,
    in_path: &mut HashSet<Uuid>,
) -> bool {
    if in_path.contains(&id) {
        return true;
    }
    if visited.contains(&id) {
        return false;
    }

    visited.insert(id);
    in_path.insert(id);
    path.push(id);

    if let Some(dependents) = deps.get(&id) {
        for dep in dependents {
            if dfs_cycle(*dep, deps, visited, path, in_path) {
                return true;
            }
        }
    }

    path.pop();
    in_path.remove(&id);
    false
}

fn decompose_goal(goal: &str) -> Vec<String> {
    // Simple heuristic decomposition
    let separators = [",", "then", "and", "after that", "next", "finally"];
    let mut steps = Vec::new();

    let mut current = String::new();
    for word in goal.split_whitespace() {
        if separators.contains(&word.to_lowercase().as_str()) {
            if !current.is_empty() {
                steps.push(current.trim().to_string());
                current = String::new();
            }
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        }
    }
    if !current.is_empty() {
        steps.push(current.trim().to_string());
    }

    if steps.is_empty() {
        steps.push(goal.to_string());
    }

    steps
}

#[async_trait]
impl Planner for PlannerImpl {
    async fn plan(&self, goal: &str, _context: &[Message]) -> AirisResult<ExecutionPlan> {
        let sub_goals = decompose_goal(goal);
        let mut steps = Vec::new();
        let mut prev_id: Option<Uuid> = None;

        for (i, sub) in sub_goals.iter().enumerate() {
            let id = Uuid::new_v4();
            let depends_on = prev_id.map(|p| vec![p]).unwrap_or_default();

            steps.push(PlanStep {
                id,
                description: sub.clone(),
                action: AgentAction::Think {
                    thought: format!("Step {}: {}", i + 1, sub),
                },
                depends_on,
                status: StepStatus::Pending,
            });

            prev_id = Some(id);
        }

        // If no decomposition, create a single step
        if steps.is_empty() {
            steps.push(PlanStep {
                id: Uuid::new_v4(),
                description: goal.to_string(),
                action: AgentAction::Think {
                    thought: format!("Execute: {}", goal),
                },
                depends_on: Vec::new(),
                status: StepStatus::Pending,
            });
        }

        // Check for loops
        let loops = Self::detect_loops(&steps);
        if !loops.is_empty() {
            return Err(AirisError::PlanningFailed(
                format!("Plan contains {} dependency loop(s)", loops.len()),
            ));
        }

        Ok(ExecutionPlan {
            id: Uuid::new_v4(),
            goal: goal.to_string(),
            steps,
            created_at: Utc::now(),
            status: PlanStatus::Draft,
        })
    }

    async fn refine(&self, plan: &ExecutionPlan, feedback: &str) -> AirisResult<ExecutionPlan> {
        // Add new steps based on feedback
        let mut new_plan = plan.clone();
        let feedback_steps = decompose_goal(feedback);

        for (i, step_desc) in feedback_steps.iter().enumerate() {
            new_plan.steps.push(PlanStep {
                id: Uuid::new_v4(),
                description: step_desc.clone(),
                action: AgentAction::Think {
                    thought: format!("Refinement step {}: {}", i + 1, step_desc),
                },
                depends_on: vec![plan.steps.last().map(|s| s.id).unwrap_or(Uuid::new_v4())],
                status: StepStatus::Pending,
            });
        }

        Ok(new_plan)
    }

    async fn validate_step(&self, step: &PlanStep) -> AirisResult<bool> {
        // Basic validation: non-empty description, valid action
        if step.description.is_empty() {
            return Ok(false);
        }

        match &step.action {
            AgentAction::Think { thought } => Ok(!thought.is_empty()),
            AgentAction::UseTool { tool, .. } => Ok(!tool.is_empty()),
            AgentAction::Respond { content } => Ok(!content.is_empty()),
            AgentAction::Delegate { agent, task } => Ok(!agent.is_empty() && !task.is_empty()),
            AgentAction::Finish { result } => Ok(!result.is_empty()),
            AgentAction::Error { .. } => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_plan_creation() {
        let planner = PlannerImpl::new();
        let plan = planner.plan("Write a Rust function and then test it", &[]).await.unwrap();
        assert!(!plan.steps.is_empty());
        assert_eq!(plan.status, PlanStatus::Draft);
    }

    #[test]
    fn test_decompose_goal() {
        let steps = decompose_goal("analyze the code, then fix the bug, and finally test it");
        assert_eq!(steps.len(), 3);
    }

    #[test]
    fn test_detect_cycles() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let id3 = Uuid::new_v4();

        let steps = vec![
            PlanStep {
                id: id1,
                description: "Step 1".into(),
                action: AgentAction::Think { thought: "1".into() },
                depends_on: vec![id2], // Depends on step 2 (cycle!)
                status: StepStatus::Pending,
            },
            PlanStep {
                id: id2,
                description: "Step 2".into(),
                action: AgentAction::Think { thought: "2".into() },
                depends_on: vec![id3],
                status: StepStatus::Pending,
            },
            PlanStep {
                id: id3,
                description: "Step 3".into(),
                action: AgentAction::Think { thought: "3".into() },
                depends_on: vec![id1], // Depends on step 1 (cycle!)
                status: StepStatus::Pending,
            },
        ];

        let cycles = PlannerImpl::detect_loops(&steps);
        assert!(!cycles.is_empty());
    }
}
