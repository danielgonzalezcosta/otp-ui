/* eslint-disable no-console */
/**
 * This script collects message ids gathered by the formatjs extract command in the specified files and folder(s)
 * and creates a CSV file with the id, description, and messages in the selected language(s).
 * This script is shipped as part of a package so it can be used in other code bases as needed.
 */
// Example usage for all packages and all languages in this repo:
//   node path-to/lib/collect-i18n-messages.js ../**/src ../**/i18n
// Example usage for all packages and one language in this repo:
//   node path-to-lib/collect-i18n-messages.js ../**/src ../**/i18n/en-US.yml

import { extract } from "@formatjs/cli";
import flatten from "flat";

import { isNotSpecialId, loadYamlFile, sortSourceAndYmlFiles } from "./util";

/**
 * Collect all messages and create a formatted output.
 */
async function collectAndPrintOutMessages({ sourceFiles, ymlFilesByLocale }) {
  // Gather message ids from code.
  const messagesFromCode = JSON.parse(await extract(sourceFiles, {}));
  const messageIdsFromCode = Object.keys(messagesFromCode);
  const allLocales = Object.keys(ymlFilesByLocale);

  // CSV heading
  console.log(`ID,Description,${allLocales.join(",")}`);

  // Will contain id, description, and a column for each language.
  const messageData = {};

  // For each locale, check that all ids in messages are in the yml files.
  // Accessorily, log message ids from yml files that are not used in the code.
  await Promise.all(
    allLocales.map(async locale => {
      const allI18nPromises = ymlFilesByLocale[locale].map(loadYamlFile);
      const allI18nMessages = await Promise.all(allI18nPromises);
      let allI18nMessagesFlattened = {};

      allI18nMessages.forEach(i18nMessages => {
        const flattenedMessages: Record<string, string> = flatten(i18nMessages);
        allI18nMessagesFlattened = {
          ...allI18nMessagesFlattened,
          ...flattenedMessages
        };
      });

      messageIdsFromCode.filter(isNotSpecialId).forEach(id => {
        const { description } = messagesFromCode[id];
        const message = allI18nMessagesFlattened[id]?.trim() || undefined;
        // console.log(`${id},"${description}","${message}"`);

        if (!messageData[id]) {
          messageData[id] = {
            description
          };
        }
        messageData[id][locale] = message;
      });
    })
  );

  Object.keys(messageData).forEach(id => {
    const row = messageData[id];
    const messages = allLocales.map(locale => row[locale]);
    console.log(`${id},"${row.description}","${messages}"`);
  });
}

sortSourceAndYmlFiles(process.argv).then(collectAndPrintOutMessages);
