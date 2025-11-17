import "dotenv/config";
import { App } from "cdktf";
import { TurboVetsStack } from "./stack";

const app = new App();
new TurboVetsStack(app, `turbovets-devops-${process.env.ENVIRONMENT}`);
app.synth();