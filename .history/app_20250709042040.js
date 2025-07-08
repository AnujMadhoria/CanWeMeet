const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const cron = require('node-cron');
const https = require('https'); 

const socketio=require('socket.io')

const server=http.createServer(app)

const io=socketio(server);

app.set("view engine","ejs");
app.use(express.static(path.join(__dirname,"public")));

const colors = [
    "red", "blue", "green", "orange", "purple", "brown", "magenta", "cyan", "lime", "teal"
];
const userColors = {};
const userLocations = {};
const messages = {}; // Store messages by msgId
const miniChatHistories = {}; // key: groupKey, value: array of messages

function getRandomColor() {
    // Pick a color not in use, or random if all are used
    const available = colors.filter(c => !Object.values(userColors).includes(c));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : colors[Math.floor(Math.random() * colors.length)];
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getMiniChatKey(users) {
    return users.sort().join('-');
}

io.on("connection", function(socket){
    // Assign a color to this user
    const color = getRandomColor();
    userColors[socket.id] = color;

    // Send all current locations and colors to the new user
    socket.emit("all-locations", userLocations);
    socket.emit("your-color", color);

    socket.on("send-location", function(data){
        userLocations[socket.id] = { id: socket.id, ...data, color: userColors[socket.id] };
        console.log("Received from client:", data);
        io.emit("receive-location", { id: socket.id, ...data, color: userColors[socket.id] });
    });

    socket.on("chat-message", function(data){
        const msgId = Date.now() + "_" + socket.id;
        let replyText = null, replyColor = null;
        if (data.replyTo && messages[data.replyTo]) {
            replyText = messages[data.replyTo].message;
            replyColor = messages[data.replyTo].color;
        }
        const msgObj = {
            ...data,
            msgId,
            color: userColors[socket.id],
            replyText,
            replyColor
        };
        messages[msgId] = msgObj;
        io.emit("chat-message", msgObj);
    });

    socket.on('request-nearby-users', function(myLoc) {
        const users = [];
        for (const [id, loc] of Object.entries(userLocations)) {
            if (id !== socket.id) {
                const dist = getDistance(myLoc.latitude, myLoc.longitude, loc.latitude, loc.longitude);
                if (dist <= 30) {
                    users.push({ id, color: userColors[id] });
                }
            }
        }
        // Also include self for chat
        users.push({ id: socket.id, color: userColors[socket.id] });
        socket.emit('nearby-users', users);
    });

    socket.on('mini-chat-message', function({ users, message }) {
        const groupKey = getMiniChatKey(users);
        if (!miniChatHistories[groupKey]) miniChatHistories[groupKey] = [];
        const msgObj = { from: socket.id, message, color: userColors[socket.id] };
        miniChatHistories[groupKey].push(msgObj);
        users.forEach(uid => {
            io.to(uid).emit('mini-chat-message', msgObj);
        });
    });

    socket.on('mini-chat-history', function(users) {
        const groupKey = getMiniChatKey(users);
        socket.emit('mini-chat-history', miniChatHistories[groupKey] || []);
    });

    socket.on('chat-voice', function({ audio }) {
        io.emit('chat-voice', { from: socket.id, audio, color: userColors[socket.id] });
    });

    socket.on("disconnect", function(){
        delete userLocations[socket.id];
        delete userColors[socket.id];
        io.emit("a-user-disconnected", socket.id);
        console.log("disconnected");
    });
    socket.on('stop-location', function() {
        delete userLocations[socket.id];
        io.emit("a-user-disconnected", socket.id);
    });
})

app.get('/', (req, res) => {
  res.render("index");
});

server.listen(3000);


const SELF_URL = 'https://canwemeet.onrender.com'; 

cron.schedule('*/10 * * * * *', () => {
    https.get(SELF_URL, (res) => {
        console.log('Self-ping to prevent sleep:', res.statusCode);
    }).on('error', (e) => {
        console.error('Self-ping error:', e);
    });
});