import * as functions from "firebase-functions";

import * as admin from "firebase-admin";

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const updateGlobalHighScores = functions
    .runWith({ timeoutSeconds: 5 })
    .firestore.document("highscores/{userId}")
    .onUpdate(async (snapshot, context) => {
        let userId = context.params.userId;
        // Pull out the updated highscore data
        let newHighscoreData = snapshot.after.data();

        // Store the global highscores doc path
        let highScoresPath: string = "globalHighscores/B7xydWc3VI2uBbinkt8P";

        // Get the global highscores doc data
        let highScoresObject = (
            await admin.firestore().doc(highScoresPath).get()
        ).data();

        // Check that a global highscores list was found
        if (highScoresObject == undefined) return null;

        // Pull out the high scores list
        let highScores: Array<any> = highScoresObject.highScores;

        // Index where the new highscore should be ranked
        let index = 0;

        // TODO: While it should never happen, things will break if there are multiple highscore records for a user
        // If it exists, find the user's previous highscore and remove it
        if (highScores.findIndex == undefined) highScores = new Array<any>();

        let oldHighScoreIndex = highScores.findIndex(
            (value) => value.userId === userId
        );
        if (oldHighScoreIndex != -1) {
            highScores.splice(oldHighScoreIndex, 1);
        }

        // Init values, set low to the last high score and high to the first high score
        let highIndex = 0;
        let lowIndex = highScores.length - 1;

        // Handle Edge cases
        // Lowest score or empty high scores list
        if (
            lowIndex == -1 ||
            highScores[lowIndex].highScore >= newHighscoreData.highScore
        ) {
            highScores.push({
                userId: userId,
                highScore: newHighscoreData.highScore,
            });
        }
        // Highest score
        else if (highScores[highIndex].highScore < newHighscoreData.highScore) {
            highScores.unshift({
                userId: userId,
                highScore: newHighscoreData.highScore,
            });
        }
        // Find the index for this highscore
        else {
            index = Math.floor(highScores.length / 2);

            while (index != lowIndex && index - 1 != highIndex) {
                // Set index to the middle point

                if (highScores[index].highScore == newHighscoreData.highScore) {
                    // Set low to just before our middle point
                    lowIndex = index;
                    // Set high to our middle point, as older high scores should be ranked higher
                    highIndex = index - 1;

                    // Keep shifting the value of index until the previous entry is smaller
                    for (
                        ;
                        index < highScores.length &&
                        lowIndex != newHighscoreData.highScore;
                        index++
                    ) {
                        lowIndex = highScores[index];
                        highIndex = highScores[index - 1];
                    }

                    break;
                }
                // Is middle larger than the new score? Then the index is somewhere in the lower half
                else if (highScores[index].highScore > newHighscoreData.highScore) {
                    highIndex = index;
                }
                // Is middle smaller than the new score? Then the index is somewhere in the bigger half
                else if (highScores[index].highScore < newHighscoreData.highScore) {
                    lowIndex = index;
                }

                index = Math.floor((lowIndex - highIndex) / 2);
            }

            highScores.splice(index, 0, {
                userId: userId,
                highScore: newHighscoreData.highScore,
            });
        }
        // Update high scores
        highScoresObject.highScores = highScores;

        // TEMP: Do a final sort to ensure things are getting messed up, maintaing a sorted array is hard...
        highScores.sort((a, b) => b.highScore - a.highScore);
        await admin.firestore().doc(highScoresPath).set(highScoresObject);

        functions.logger.info("PRINTING UPDATED GLOBAL HIGHSCORE OBJECT");
        functions.logger.info(highScoresObject);
        return null;
    });

export const getLocalHighScores = functions.https.onRequest(
    async (req, res) => {
        // Grab the text parameter.
        const userId = req.query.userId;

        // Store the global highscores doc path
        let highScoresPath: string = "globalHighscores/B7xydWc3VI2uBbinkt8P";

        // Get the global highscores doc data
        let highScoresObject = (
            await admin.firestore().doc(highScoresPath).get()
        ).data();

        // Check that a global highscores list was found
        if (highScoresObject == undefined) return;

        // Pull out the high scores list
        let highScores: Array<any> = highScoresObject.highScores;

        // Find the index of this user's high score
        let userIndex = highScores.findIndex((value) => value.userId == userId);

        // Return an error if no user was found
        if (userIndex == -1)
            res.status(400).json({ message: "No matching user ID was found" });

        // Splice out a window of high scores
        let windowStart = userIndex - 5 >= 0 ? userIndex - 5 : 0;
        let localHighScores = highScores.splice(windowStart, 11);

        // Set the rank of each high score
        let offset = userIndex - 5 >= 0 ? -5 : -userIndex;
        for (let index = 0; index < localHighScores.length; index++) {
            localHighScores [index].rank = (userIndex + offset) + 1;
            offset++;
        }

        functions.logger.info({ userRank: userIndex + 1, localHighScores: localHighScores });
        // Send back a message that we've successfully written the message
        res.json({ userRank: userIndex + 1, localHighScores: localHighScores });
    }
);
