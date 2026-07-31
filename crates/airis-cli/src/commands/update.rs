//! `airis update` — Check for updates.

use airis_core::prelude::*;

pub async fn execute(check: bool) -> AirisResult<()> {
    if check {
        println!("AIRIS-CLI v{}", env!("CARGO_PKG_VERSION"));
        println!("Checking for updates...");
        println!("Update check coming soon.");
    } else {
        println!("Update command coming soon.");
    }
    Ok(())
}
