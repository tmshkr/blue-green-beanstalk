import { parse } from "yaml";
import { readFileSync, writeFileSync } from "fs";

function parseActionYaml() {
  const { inputs, outputs } = parse(readFileSync("../action.yml", "utf8"));
  let inputsTable = `
## Inputs
### Required Inputs
| Name | Description |
| ---- | ----------- |`;
  for (const key in inputs) {
    const input = inputs[key];
    if (input.required) {
      inputsTable += `
| ${key} | ${input.description.replaceAll("\n", "<br/>")} |`;
    }
  }
  inputsTable += `
### Dependent Inputs
Inputs that must be provided together.
| Name | Description | Needs |
| ---- | ----------- | ----- |`;
  for (const key in inputs) {
    const input = inputs[key];
    if (input.needs) {
      inputsTable += `
| ${key} | ${input.description.replaceAll("\n", "<br/>")} | ${input.needs
        .map((other) => `\`${other}\``)
        .join(", ")} |`;
    }
  }
  inputsTable += `
### Optional Inputs
| Name | Default | Description |
| ---- | ------- | ----------- |`;
  for (const key in inputs) {
    const input = inputs[key];
    if (!input.required && !input.needs) {
      inputsTable += `
| ${key} | ${input.default ?? ""} | ${input.description.replaceAll(
        "\n",
        "<br/>"
      )} |`;
    }
  }

  let outputsTable = `
## Outputs
| Name | Description |
| ---- | ----------- |`;
  for (const key in outputs) {
    const output = outputs[key];
    outputsTable += `
| ${key} | ${output.description.replaceAll("\n", "<br/>")} |`;
  }
  return inputsTable + outputsTable;
}

async function writeToReadme() {
  const actionsTable = parseActionYaml();
  const readme = readFileSync("../README.md", "utf8");
  writeFileSync(
    "../README.md",
    readme.replace(
      /<!-- START_ACTIONS_TABLE -->([\s\S])*<!-- END_ACTIONS_TABLE -->/g,
      `<!-- START_ACTIONS_TABLE -->\n${actionsTable}\n<!-- END_ACTIONS_TABLE -->`
    )
  );
}

writeToReadme();
