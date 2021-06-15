const { executionAsyncResource } = require('async_hooks');
const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const { YTSearcher } = require('ytsearcher');

const searcher = new YTSearcher({
    key: process.env.youtube_api, // YOUTUBE API KEY 
    revealed: true
});

const client = new Discord.Client();

const queue = new Map();

client.on("ready", () =>{
    console.log("BEN HAZIRIM!")
})

client.on("message", async(message) => {
    const prefix = '*';

    const serverQueue = queue.get(message.guild.id);

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    switch(command){
        case `play`:
            execute(message, serverQueue);
            break;
        case `stop`:
            stop(message, serverQueue);
            break;
        case `skip`:
            skip(message, serverQueue);
            break;
        case `pause`:
            pause(serverQueue);
            break;
        case `resume`:
            resume(serverQueue);    
            break;
        case `loop`:
            Loop(args, serverQueue);
            break;
        case `queue`:
            Queue(serverQueue);
            break;
    }
    
    async function execute(message, serverQueue){
        let vc = message.member.voice.channel;
        if(!vc){
            return message.channel.send("Önce bi kanala gir sonra konuşuruz.")
        }
        else{
            let result = await searcher.search(args.join(" "), {type: "video"})
            const songInfo = await ytdl.getInfo(result.first.url);

            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
                likes: songInfo.videoDetails.likes
            };

            if(!serverQueue){
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true,
                    loopone: false,
                    loopall:false
                };

                queue.set(message.guild.id, queueConstructor);

                queueConstructor.songs.push(song);

                try{
                    let connection = await vc.join();
                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                }
                catch(err){
                    console.error(err);
                    queue.delete(msg.guild.id);
                    return message.channel.send(`Ses kanallarına katılamıyorum ${err}`)
                }
            }
            else{
                serverQueue.songs.push(song);
                return message.channel.send(`${song.url} sıraya alındı`);
            }
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
            .on('finish', () => {
                if(serverQueue.loopone){
                    play(guild, serverQueue.songs[0]);
                }
                else if(serverQueue.loopall){
                    serverQueue.songs.push(serverQueue.songs[0]);
                    serverQueue.songs.shift();
                }
                else{
                    serverQueue.songs.shift();
                }
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0]);
            })
            serverQueue.txtChannel.send(`Bak dinle dinle ${serverQueue.songs[0].url}`)
    }

    function stop(message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("Önce bi kanala gir sonra konuşuruz."); 
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    }
    
    function skip(message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("Önce bi kanala gir sonra konuşuruz."); 
        if(!serverQueue)
            return message.channel.send("Sırada şarkı yok ki skipleyeyim!")
        serverQueue.connection.dispatcher.end();
    }

    function pause(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("Çalan bi şarkı yok ki duraklatayım.")
        if(!message.member.voice.channel)
            return message.channel.send("Hiçbir kanalda göremiyorum seni?!")
        if(serverQueue.connection.dispatcher.paused)
            return message.channel.send("Çoktan durdurdum kanka ben o şarkıyı")
        serverQueue.connection.dispatcher.pause();
        message.channel.send("Tamam, şarkıyı durdurdum")
    }

    function resume(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("Durdurulmuş bi şarkı yok ki başlatayım.")
        if(!message.member.voice.channel)
            return message.channel.send("Hiçbir kanalda göremiyorum seni?!")
        if(serverQueue.connection.dispatcher.resumed)
            return message.channel.send("Çoktan başlattım kanka ben o şarkıyı!")
        serverQueue.connection.dispatcher.resume();
        message.channel.send("Tamam, şarkıyı başlattım!")
    }

    function Loop(args, serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("Repertuarımda hiç şarkı yok biliyor musun?..")
        if(!message.member.voice.channel)
            return message.channel.send("Hiçbir kanalda göremiyorum seni?!")
        switch(args[0].toLowerCase()){
            case `all`:
                serverQueue.loopall = !serverQueue.loopall;
                serverQueue.loopone = false;

                if(serverQueue.loopall === true){
                    message.channel.send("Listede ne varsa tekrar çaldırıyom he, haberin olsun!");
                }
                else
                    message.channel.send("Tekrarlamayı kapattım!");
                break;
            case `one`:
                serverQueue.loopone = !serverQueue.loopone;
                serverQueue.loopall = false;

                if(serverQueue.loopone === true){
                    message.channel.send("Bu şarkıyı tekrar çaldırıyom he, haberin olsun!");
                }
                else
                    message.channel.send("Tekrarlamayı kapattım!");
                break;
            case `off`:
                    serverQueue.loopall = false;
                    serverQueue.loopall = false;
                    message.channel.send("Tekrarlamayı kapattım!")
                break;
            default:
                message.channel.send("Neyi tekrar dinlemek istiyorsun? *loop <one / all / off> şeklinde belirtmelisin.");
        }
    }

    function Queue(serverQueue){
        if(!serverQueue.connection)
            return message.channel.send("Repertuarımda hiç şarkı yok biliyor musun?..")
        if(!message.member.voice.channel)
            return message.channel.send("Hiçbir kanalda göremiyorum seni?!")
        
        let nowPlaying = serverQueue.songs[0];
        let qMsg = `Şu an çalan: ${nowPlaying.title}\n -------------------- \n`

        for(var i = 1; i > serverQueue.songs.length; i++){
            qMsg += `${i}. ${serverQueue.songs[i].title}\n`
        }

        message.channel.send('```' + qMsg + 'Requested by:' + message.author.username + '```');
    }

})

client.login(process.env.token) // DISCORD BOT KEY  