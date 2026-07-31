//! `airis fix` — Fix code issues automatically.

use crate::CommandContext;
use airis_core::prelude::*;

/// Execute the fix command.
pub async fn execute(
    target: &Option<String>,
    yes: bool,
    ctx: &CommandContext,
) -> AirisResult<()> {
    let target_path = target.as_deref().unwrap_or(".");
    println!("Analyzing {} for issues...", target_path);

    // Gather diagnostics from LSP
    let path = std::path::Path::new(target_path);
    let diagnostics = ctx.lsp.diagnostics(path).await?;

    if diagnostics.is_empty() {
        println!("No issues found via LSP diagnostics.");
    } else {
        let error_count = diagnostics
            .iter()
            .filter(|d| d.severity == LspSeverity::Error)
            .count();
        let warning_count = diagnostics
            .iter()
            .filter(|d| d.severity == LspSeverity::Warning)
            .count();
        println!(
            "Found {} diagnostic(s): {} error(s), {} warning(s)",
            diagnostics.len(),
            error_count,
            warning_count
        );
        for diag in &diagnostics {
            let severity = match diag.severity {
                LspSeverity::Error => "\x1b[31merror\x1b[0m",
                LspSeverity::Warning => "\x1b[33mwarning\x1b[0m",
                LspSeverity::Info => "info",
                LspSeverity::Hint => "hint",
            };
            println!(
                "  {}:{}:{} [{}] {}",
                diag.file.display(),
                diag.line,
                diag.column,
                severity,
                diag.message
            );
        }
    }

    // Build a focused description including diagnostics
    let description = if diagnostics.is_empty() {
        format!(
            "Analyze and fix code issues in: {}\nAnalyze the code for potential bugs, style issues, \
             and improvements. Use the editor to apply fixes.",
            target_path
        )
    } else {
        let diag_summary: Vec<String> = diagnostics
            .iter()
            .map(|d| {
                format!(
                    "{}:{}:{} [{}] {}",
                    d.file.display(),
                    d.line,
                    d.column,
                    match d.severity {
                        LspSeverity::Error => "error",
                        LspSeverity::Warning => "warning",
                        LspSeverity::Info => "info",
                        LspSeverity::Hint => "hint",
                    },
                    d.message
                )
            })
            .collect();
        format!(
            "Analyze and fix code issues in: {}\n\nDiagnostics found:\n{}\n\nUse the editor to apply fixes. \
             Focus on addressing the diagnostics listed above.",
            target_path,
            diag_summary.join("\n")
        )
    };

    // Use ctx.runner.code for AI-powered fixing
    let result = ctx.runner.code(&description, 15).await?;

    println!();
    if result.success {
        println!("{}", result.output);
        if yes {
            println!("Fixes applied automatically.");
        } else {
            println!("Review the changes above. Use --yes to auto-apply.");
        }
    } else {
        eprintln!("Fix failed: {}", result.output);
    }

    println!();
    println!("Steps taken: {}", result.steps_taken);
    println!(
        "Tokens: {} prompt + {} completion = {} total",
        result.token_usage.prompt_tokens,
        result.token_usage.completion_tokens,
        result.token_usage.total_tokens
    );

    Ok(())
}
