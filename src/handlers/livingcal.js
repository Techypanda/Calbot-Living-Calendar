const axios = require('axios');
const Discord = require('discord.js');

var AWS = require('aws-sdk'),
    region = "ap-southeast-2",
    secretName = "calbo",
    secret,
    decodedBinarySecret;

var client = new AWS.SecretsManager({
    region: region
});


const COLUMNS = {
    EVENT_NAME: 1,
    LOCATION: 2,
    DATE: 3,
    TIME: 4
}
const MAINTITLEIMAGE = new Discord.MessageAttachment('https://i.imgur.com/6UzkKIB.png');
const COMINGUPSOONIMAGE = new Discord.MessageAttachment('https://i.imgur.com/rB06Ixt.png');
const NEXTCOUPLEMONTHSIMAGE = new Discord.MessageAttachment('https://i.imgur.com/Sjc63lh.png');
const FUTUREPLANSIMAGE = new Discord.MessageAttachment('https://imgur.com/7LaaVHv.png');
exports.scheduledEventLoggerHandler = async (event, context) => {
    async function sendSection(img, arr, channel, emdTitle) {
        await channel.send(img);
        let sendString = [];
        const exampleEmbed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle(emdTitle)
            .setTimestamp()
        arr.forEach((el) => {
            if (el.type != "FUTUREPLANS") {
                exampleEmbed.addField(el.title,
                    `${el.title} - ${el.date} : ${el.time} @ ${el.location}`);
            } else {
                exampleEmbed.addField(el.title,
                    `${el.title} - ${el.location}`);
            }
        })
        exampleEmbed.setFooter("⠀".repeat(99) + "|")
        await channel.send(exampleEmbed)
    }
    function addEntry(map, value, key, newKey) {
        if (map[key] == null) {
            map[key] = {};
            map[key][newKey] = value;
        } else {
            map[key][newKey] = value;
        }
    }
    function timeDiff(date) {
        const today = new Date();
        const targetDate = new Date(date);
        const timeDiff = Math.abs(today.getTime() - targetDate.getTime())
        const dayDiff = Math.round(timeDiff / (1000 * 3600 * 24));
        if (dayDiff >= 60) {
            return 'FUTURE';
        } else if (dayDiff >= 14) {
            return 'NEXTCOUPLE';
        } else {
            return 'COMINGUP';
        }
    }
    function discordBot(ComingUp, FuturePlans, NextCouple, login) { // cursed way of waiting
        return new Promise((resolve, reject) => {
            const client = new Discord.Client();
            client.on('ready', () => {
                console.info(`Logged in as ${client.user.tag}!`);
                try {
                    console.info("reached");
                    const LivingCalendarChannel = client.channels.cache.get('711131347275612180');
                    LivingCalendarChannel.bulkDelete(20).then(() => {
                        LivingCalendarChannel.send(MAINTITLEIMAGE).then(() => {
                            sendSection(COMINGUPSOONIMAGE, ComingUp, LivingCalendarChannel, "Coming Up Soon").then(() => {
                                sendSection(NEXTCOUPLEMONTHSIMAGE, NextCouple, LivingCalendarChannel, "Next Couple Of Months").then(() => {
                                    sendSection(FUTUREPLANSIMAGE, FuturePlans, LivingCalendarChannel, "Future Plans").then(() => {
                                        resolve("Calendar Has Been Updated");
                                    }).catch((err) => {
                                        reject(err);
                                    })
                                }).catch((err) => {
                                    reject(err);
                                })
                            }).catch((err) => {
                                reject(err)
                            })
                        }).catch((err) => {
                            reject(err)
                        })
                    }).catch((err) => {
                        reject(err)
                    })
                } catch {
                    console.info("Pain...");
                    reject("AAAAAAAA");
                }
            });
            client.login(login);
        });
    }

    function secretHandler() {
        return new Promise((resolve, reject) => {
            client.getSecretValue({ SecretId: secretName }, (err, data) => {
                if (err) { // if it fails i dont really care, it means aws fucked up not me!
                    if (err.code === 'DecryptionFailureException')
                        reject(err);
                    else if (err.code === 'InternalServiceErrorException')
                        reject(err);
                    else if (err.code === 'InvalidParameterException')
                        reject(err);
                    else if (err.code === 'InvalidRequestException')
                        reject(err);
                    else if (err.code === 'ResourceNotFoundException')
                        reject(err);
                }
                else {
                    let out;
                    if ('SecretString' in data) {
                        out = data.SecretString;
                    } else {
                        let buff = new Buffer(data.SecretBinary, 'base64');
                        out = buff.toString('ascii');
                    }
                    resolve(out);
                }
            })
        });
    }

    console.info("AWS Secrets Loading..");
    const login = JSON.parse(await secretHandler())["login"];
    console.info("Loaded AWS Secrets");
    console.info("Beginning Living Calendar Bot");
    const ComingUp = [];
    const FuturePlans = [];
    const NextCouple = [];
    const gSheet = await axios.get("https://spreadsheets.google.com/feeds/cells/1t_g-HvvmDHDUbYNaPvd6_oE3-sYjv91BSE_t9YaHz1U/1/public/full?alt=json");
    const Map = {};
    gSheet.data.feed.entry.forEach((entry) => {
        if (entry.content['$t'] != "Event Name" && entry.content['$t'] != "Location" && entry.content['$t'] != "Date" && entry.content['$t'] != "Time") {
            if (entry['gs$cell'].col == COLUMNS.EVENT_NAME) {
                addEntry(Map, entry.content['$t'], entry['gs$cell'].row, "title")
            } else if (entry['gs$cell'].col == COLUMNS.LOCATION) {
                addEntry(Map, entry.content['$t'], entry['gs$cell'].row, "location")
            } else if (entry['gs$cell'].col == COLUMNS.DATE) {
                const date = entry.content['$t'].split('/');
                addEntry(Map, entry.content['$t'], entry['gs$cell'].row, "date");
                addEntry(Map, `${date[2]}-${date[1]}-${date[0]}`, entry['gs$cell'].row, "utcDate");
            } else if (entry['gs$cell'].col == COLUMNS.TIME) {
                addEntry(Map, entry.content['$t'], entry['gs$cell'].row, "time");
            }
        }
    })
    for (const [key, value] of Object.entries(Map)) {
        const TYPE = timeDiff(value["utcDate"]);
        if (TYPE == "COMINGUP") {
            value.type = "COMINGUP";
            ComingUp.push(value);
        } else if (TYPE == "NEXTCOUPLE") {
            value.type = "NEXTCOUPLE";
            NextCouple.push(value);
        } else {
            value.type = "FUTUREPLANS";
            FuturePlans.push(value);
        }
    }
    // Discord Frontend
    const resp = await discordBot(ComingUp, FuturePlans, NextCouple, login);
    console.info(resp);
}