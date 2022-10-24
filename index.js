const { executionAsyncResource } = require('async_hooks');
 
const Discord = require('discord.js')
 
const client = new Discord.Client();
 
const ytdl = require('ytdl-core');
 
const ytSearch = require('yt-search')
 
const searcher = new YTSearcher({
    key: process.env.youtube_api,
    revealed: true
})
 
const fs = require('fs');
 
const prefix = 'a!';
 
const queue = new Map();
 
client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
 
fs.readdir("./commands/", (e, f) => {
    if(e) return console.error(e);
    f.forEach(file => {
        if(!file.endsWith(".js")) return
        console.log(`${file} has been loaded!`)
        let cmd = require(`./commands/${file}`);
        let cmdName = cmd.config.name;
        client.commands.set(cmdName, cmd)
        cmd.config.aliases.forEach(alias => {
            client.aliases.set(alias, cmdName);
        })
    })
})
 
 
client.once('ready', () => {
    console.log('ayaka is online!')
})
 
client.on ('message', async(message) =>{
    if(!message.content.startsWith(prefix) || message.author.bot) return;
 
    const serverQueue = queue.get(message.guild.id)
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
 
    const cmd = client.commands.get(command) || client.commands.get(client.aliases.get(command))
 
    if(!cmd) return
 
    try {
        cmd.run(client, args, message);
    }catch (err){
        return console.error(err)
    }
 
    switch(command){
        case 'play':
            execute(message, serverQueue);
            break;
        case 'leave':
            leave(message, serverQueue);
        case 'skip':
            skip(message, serverQueue);
            break;
    }
 
    async function execute(message, serverQueue){
        let vc = message.member.voice.channel;
        if(!vc){
            return message.channel.send("you'll need to be in a voice channel first!")
        } else {
            let result = await searcher.search(args.join(" "), { type: "video" })
            const songInfo = await ytdl.getInfo(result.first.url)
 
            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };
 
        } if(!serverQueue){
            const queueConstructor = {
                txtChannel: message.channel,
                vChannel: vc,
                connection: null,
                songs: [],
                volume: 10,
                playing: true
            };
            queue.set(message.guild.id, queueConstructor);
 
            queueConstructor.songs.push(song);
 
            try{
                let connection = await vc.join();
                queueConstructor.connection = connection;
                play(message.guild, queueConstructor.songs[0]);
            }catch (err){
                console.error(err);
                queue.delete(message.guild.id);
                message.channel.send(`unable to connect!`);
                throw err;
            }
        }else{
            serverQueue.songs.push(song);
            return message.channel.send(`**${song.title}** has been added to queue!`);
        }
    }
    function play(guild, song){
        const serverQueue = queue.get(guild.id);
        if(!song){
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () =>{
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0]);
            })
    }
    function leave (message, serverQueue){
        if (!message.member.voice.channel)
            return message.channel.send("you'll need to be in a voice channel for me to leave!");
        serverQueue.songs = []; 
        serverQueue.connection.dispatcher.end();
    }
    function skip (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("you'll need to be in a voice channel to skip the song!");
        if(!serverQueue)
            return message.channel.send("the queue is empty!");
        serverQueue.connection.dispatcher.end();
    }
 
});
 
 
 
client.login(process.env.token);
