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
const messages = {}; // Store messages by msgId

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