// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const Recognizers = require('@microsoft/recognizers-text-suite');
const { ActivityTypes, MessageFactory } = require('botbuilder');
const java = require('java');

java.classpath.pushDir('lib');

var NodeMainJavaClass = java.import('com.abhijeetkale.allClasses.Jbot');
var MyClass = java.import('sample.sampleClass');


// The accessor names for the conversation flow and user plan state property accessors.
const CONVERSATION_FLOW_PROPERTY = 'conversationFlowProperty';
const USER_PLAN_PROPERTY = 'userProfileProperty';

// Identifies the last question asked.
const question = {
    filename: "filename",
    users: "users",
    execution: "execution",
    none: "none"
}

// Defines a bot for filling a user plan.
class MyBot {
    constructor(conversationState, userState) {
        // The state property accessors for conversation flow and user plan.
        this.conversationFlow = conversationState.createProperty(CONVERSATION_FLOW_PROPERTY);
        this.userPlan = userState.createProperty(USER_PLAN_PROPERTY);

        // The state management objects for the conversation and user.
        this.conversationState = conversationState;
        this.userState = userState;
    }

    // The bot's turn handler.
    async onTurn(turnContext) {
        // This bot listens for message activities.
        if (turnContext.activity.type === ActivityTypes.Message) {
            // Get the state properties from the turn context.
            const flow = await this.conversationFlow.get(turnContext, { lastQuestionAsked: question.none });
            const plan = await this.userPlan.get(turnContext, {});

            await MyBot.JmeterDetails(flow, plan, turnContext);

            // Update state and save changes.
            await this.conversationFlow.set(turnContext, flow);
            await this.conversationState.saveChanges(turnContext);

            await this.userPlan.set(turnContext, plan);
            await this.userState.saveChanges(turnContext);
        }
    }

    // Manages the conversation flow for filling out the user's plan.
    static async JmeterDetails(flow, plan, turnContext) {
        const input = turnContext.activity.text;
        let result;
		var fileDataString;
		var fileName;
        switch (flow.lastQuestionAsked) {
            // If we're just starting off, we haven't asked the user for any information yet.
            // Ask the user for jmx file name and update the conversation flag.
            case question.none:
                await turnContext.sendActivity("Let's get started. Can you please specify the file path with file name?");
                flow.lastQuestionAsked = question.filename;
	
				//console.log(fileDataString);
                break;

            // If we last asked for their file name, record their response, confirm that we got it.
            // Ask them for number of users required and update the conversation flag.
            case question.filename:
                result = this.validateFileName(input);
                if (result.success) {
                    plan.filename = result.filename;
					plan.fileDataString = NodeMainJavaClass.callReadFileMethodSync(plan.filename);
					fileName = plan.filename;
                    await turnContext.sendActivity(`I have your name as ${plan.filename}.`);
                    await turnContext.sendActivity('How many number of users?');
                    flow.lastQuestionAsked = question.users;
                    break;
                } else {
                    // If we couldn't interpret their input, ask them for it again.
                    // Don't update the conversation flag, so that we repeat this step.
                    await turnContext.sendActivity(
                        result.message || "I'm sorry, I didn't understand that.");
                    break;
                }
				//console.log(fileDataString);

            // Ask them if they want to execute test plan and update the conversation flag.
            case question.users:
                result = this.validateUsers(input);
                if (result.success) {
                    plan.users = result.users;
					//console.log(plan.users);
					//console.log(fileDataString);
					//console.log(plan.filename);
                    await turnContext.sendActivity(`You have entered number of users as ${plan.users}`);
					NodeMainJavaClass.callChangeThreadNumber(plan.fileDataString, plan.filename, plan.users);
                    await turnContext.sendActivity('Should we start the execution?');
                    flow.lastQuestionAsked = question.execution;
                    break;
                } else {
                    // If we couldn't interpret their input, ask them for it again.
                    // Don't update the conversation flag, so that we repeat this step.
                    await turnContext.sendActivity(
                        result.message || "I'm sorry, I didn't understand that.");
                    break;
                }

            // If we last asked execution details, record their response, confirm that we got it,
            // let them know the execution has started, and update the conversation flag.
            case question.execution:
                result = this.validateExecute(input);
                if (result.success){
					console.log(result);
					plan.execution = result.execution;
					if (input == 'yes' || input == 'Yes') {
						var jtlFile = ((plan.filename).substring(0, (plan.filename).length - 3)) + "jtl";
						var logFile = ((plan.filename).substring(0, (plan.filename).length - 3)) + "log";
						//console.log(jtlFile);
						//console.log(logFile);
						NodeMainJavaClass.executeTest(plan.filename, jtlFile, logFile);
						await turnContext.sendActivity(`${plan.execution} started.`);
						await turnContext.sendActivity(`Execution of ${plan.filename} file has started.`);
						await turnContext.sendActivity('Type anything to run the bot again.');
						flow.lastQuestionAsked = question.none;
						plan = {};
						break;
					} 
					else{
						await turnContext.sendActivity('Type anything to run the bot again.');
						flow.lastQuestionAsked = question.none;
						plan = {};
						break;
					}
				}
				else {
                    // If we couldn't interpret their input, ask them for it again.
                    // Don't update the conversation flag, so that we repeat this step.
                    await turnContext.sendActivity(
                        result.message || "I'm sorry, I didn't understand that.");
                    break;
                }
        }
    }

    // Validates name input. Returns whether validation succeeded and either the parsed and normalized
    // value or a message the bot can use to ask the user again.
    static validateFileName(input) {
        const filename = input && input.trim();
        return filename != undefined
            ? { success: true, filename: filename }
            : { success: false, message: 'Please enter a valid file path' };
    };

    // Validates number of users input. Returns whether validation succeeded and either the parsed and normalized
    // value or a message the bot can use to ask the user again.
    static validateUsers(input) {

        // Try to recognize the input as a number. This works for responses such as "twelve" as well as "12".
        try {
            // Attempt to convert the Recognizer result to an integer. This works for "a dozen", "twelve", "12", and so on.
            // The recognizer returns a list of potential recognition results, if any.
            const results = Recognizers.recognizeNumber(input, Recognizers.Culture.English);
            let output;
            results.forEach(function (result) {
                // result.resolution is a dictionary, where the "value" entry contains the processed string.
                const value = result.resolution['value'];
                if (value) {
                    const users = parseInt(value);
                    output = { success: true, users: users };
                    return;
                }
            });
            return output || { success: false, message: 'Please enter an age between 18 and 120.' };
        } catch (error) {
            return {
                success: false,
                message: "I'm sorry, I could not interpret that as an age. Please enter an age between 18 and 120."
            };
        }
    }

    // Validates execution state input. Returns whether validation succeeded and either the parsed and normalized
    // value or a message the bot can use to ask the user again.
    static validateExecute(input) {
        
        try {
			var output;
            const results = input.toLowerCase();
			//console.log(input);
            if(results == 'yes'){
				const execution = "execution"; 
				output = { success: true, execution:execution};
			}
			else if(results == 'no'){
				console.log("HELLO");
				const execution = "execution"; 
				output = { success: true, execution:execution};
			}
			console.log(output);
			return output;
			
        } catch (error) {
            return {
                success: false,
                message: "I'm sorry, I could not interpret the command."
            };
        }
    }
}

module.exports.MyBot = MyBot;