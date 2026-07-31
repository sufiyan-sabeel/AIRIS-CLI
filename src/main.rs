use airis_cli::AirisCli;
use clap::Parser;
use color_eyre::eyre::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // Install color-eyre for beautiful error reporting
    color_eyre::install()?;

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with_target(false)
        .compact()
        .init();

    // Parse CLI arguments and run
    let cli = AirisCli::parse();
    cli.run().await?;

    Ok(())
}
