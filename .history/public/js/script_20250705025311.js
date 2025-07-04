const socket = io()

if(navigator.geolocation){
    navigator.geolocation.watchPosition((position)=>{
        const { latitude, longitude }= position.coords;
        socket.emit("send-location",{ latitude, longitude });
    },
    (error)=>{
        console.error(error)
    },
    {
        enableHighAccuracy:true,
        timeout:1000,
        maximumAge:0,
    }
  );
}

const map = L.map("map").setView([0,0],16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{

}).addTo(map)

const markers = {};
let myColor = "black";

socket.on("your-color", function(color) {
    myColor = color;
});

function createColoredMarker(lat, lng, color) {
    return L.circleMarker([lat, lng], {
        radius: 10,
        color: color,
        fillColor: color,
        fillOpacity: 0.8
    });
}

socket.on("receive-location", (data) => {
    const { id, latitude, longitude, color } = data;
    if (id === socket.id) {
        map.setView([latitude, longitude]);
    }
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = createColoredMarker(latitude, longitude, color || "black").addTo(map);
    }
})

socket.on("a-user-disconnected",(id)=>{
    if(markers[id]){
        map.removeLayer(markers[id]);
        delete markers[id];
    }
})

socket.on("all-locations", function(locations){
    Object.values(locations).forEach(function(data){
        const { id, latitude, longitude, color } = data;
        if (!markers[id]) {
            markers[id] = createColoredMarker(latitude, longitude, color || "black").addTo(map);
        } else {
            markers[id].setLatLng([latitude, longitude]);
        }
    });
});

// Sending a chat message
document.getElementById('chat-form').addEventListener('submit', function(e){
    e.preventDefault();
    const message = document.getElementById('chat-input').value;
    if (message.trim() !== "") {
        socket.emit('chat-message', { message });
        document.getElementById('chat-input').value = '';
    }
});

// Receiving a chat message
socket.on('chat-message', function(data){
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = "chat-message";
    msgDiv.dataset.msgId = data.msgId; // Unique message ID

    msgDiv.innerHTML = `
        <span class="chat-username" style="color:${data.color};background:${data.color}22">${data.color}</span>
        <span>${data.message}</span>
        <span class="reactions"></span>
        <button class="react-btn" title="React">😊</button>
    `;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});

document.getElementById('chat-box').addEventListener('click', function(e) {
    if (e.target.classList.contains('react-btn')) {
        const msgDiv = e.target.closest('.chat-message');
        const msgId = msgDiv.dataset.msgId;
        // Show emoji picker (simple prompt for demo)
        const emoji = prompt("React with emoji (e.g., 👍, 😂, ❤️):", "👍");
        if (emoji) {
            socket.emit('add-reaction', { msgId, emoji });
        }
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const toggleBtn = document.getElementById('toggle-map-btn');
    const mapDiv = document.getElementById('map');
    const chatArea = document.getElementById('chat-area');
    let mapHidden = false;

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            mapHidden = !mapHidden;
            if (mapHidden) {
                mapDiv.classList.add('map-hidden');
                chatArea.classList.add('chat-expanded');
                toggleBtn.textContent = "Show Map";
            } else {
                mapDiv.classList.remove('map-hidden');
                chatArea.classList.remove('chat-expanded');
                toggleBtn.textContent = "Hide Map";
            }
        });
    }
});

socket.on('update-reactions', function({ msgId, reactions }) {
    const msgDiv = document.querySelector(`.chat-message[data-msg-id="${msgId}"]`);
    if (msgDiv) {
        const reactionsSpan = msgDiv.querySelector('.reactions');
        reactionsSpan.textContent = Object.entries(reactions)
            .map(([emoji, users]) => `${emoji} ${users.length}`)
            .join(' ');
    }
});