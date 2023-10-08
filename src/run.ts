if (!process.env.GITHUB_ACTIONS) {
  require("dotenv").config();
}

import { main } from "./main";
import { getInputs } from "./inputs";

const inputs = getInputs();
main(inputs);
