import cac from "cac";

const cli = cac();
import { startDevServer } from "./server";

cli
  .command("[root]", "Run the development server")
  .alias("serve")
  .alias("dev")
  .action(async () => {
    await startDevServer();
  });

cli.help();

cli.parse();
