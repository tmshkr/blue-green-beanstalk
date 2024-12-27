import { App } from "aws-cdk-lib";
import { TestAlbStack } from "./TestAlbStack";

const app = new App();
new TestAlbStack(app, "TestAlbStack");
app.synth();
