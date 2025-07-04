const express = require('express');
const app = express();
const http = require('http');
const path = require('path');

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
const messageReactions = {}; // { msgId: { emoji: [userId, ...] } }

function getRandomColor() {
    // Pick a color not in use, or random if all are used
    const available = colors.filter(c => !Object.values(userColors).includes(c));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", function(socket){
    // Assign a color to this user
    const color = getRandomColor();
    userColors[socket.id] = color;

    // Send all current locations and colors to the new user
    socket.emit("all-locations", userLocations);
    socket.emit("your-color", color);

    socket.on("send-location", function(data){
        userLocations[socket.id] = { id: socket.id, ...data, color };
        io.emit("receive-location", { id: socket.id, ...data, color });
        console.log("connected");
    });

    socket.on("chat-message", function(data){
        // Generate a unique message ID (e.g., timestamp + socket.id)
        const msgId = Date.now() + "_" + socket.id;
        messageReactions[msgId] = {};
        io.emit("chat-message", { ...data, msgId });
    });

    socket.on("add-reaction", function({ msgId, emoji }) {
        if (!messageReactions[msgId]) messageReactions[msgId] = {};
        if (!messageReactions[msgId][emoji]) messageReactions[msgId][emoji] = [];
        // Prevent duplicate reactions from same user
        if (!messageReactions[msgId][emoji].includes(socket.id)) {
            messageReactions[msgId][emoji].push(socket.id);
        }
        io.emit("update-reactions", { msgId, reactions: messageReactions[msgId] });
    });

    socket.on("disconnect", function(){
        delete userLocations[socket.id];
        delete userColors[socket.id];
        io.emit("a-user-disconnected", socket.id);
        console.log("disconnected");
    });
})

app.get('/', (req, res) => {
  res.render("index");
});

server.listen(3000);