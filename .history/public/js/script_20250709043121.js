const socket = io();

const map = L.map("map").setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{}).addTo(map);

const markers = {};
let myId = null;
let myLocation = null;
let geoWatchId = null;

socket.on("connect", function() {
    myId = socket.id;
    startLocationSharing();
});

function startLocationSharing() {
    if (navigator.geolocation && geoWatchId === null) {
        geoWatchId = navigator.geolocation.watchPosition(
            function(position) {
                myLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                console.log("Sending location:", myLocation);
                socket.emit("send-location", myLocation);
            },
            function(error) {
                console.error("Geolocation error:", error);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
}

socket.on("receive-location", (data) => {
    console.log("Received location:", data);
    if (data.id === myId) {
        myLocation = { latitude: data.latitude, longitude: data.longitude };
        // map.setView([data.latitude, data.longitude], 16);
    }
    if (markers[data.id]) {
        markers[data.id].setLatLng([data.latitude, data.longitude]);
    } else {
        markers[data.id] = L.circleMarker([data.latitude, data.longitude], {
            radius: 10,
            color: data.color || "black",
            fillColor: data.color || "black",
            fillOpacity: 0.8
        }).addTo(map);
    }
});

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
            markers[id] = L.circleMarker([latitude, longitude], {
                radius: 10,
                color: color || "black",
                fillColor: color || "black",
                fillOpacity: 0.8
            }).addTo(map);
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
        socket.emit('chat-message', {
            message,
            replyTo: replyTo ? replyTo.msgId : null
        });
        document.getElementById('chat-input').value = '';
        if (replyTo) {
            replyTo = null;
            const preview = document.getElementById('reply-preview');
            if (preview) preview.remove();
        }
    }
});

// Receiving a chat message
socket.on('chat-message', function(data){
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = "chat-message";
    msgDiv.dataset.msgId = data.msgId;

    let replyHtml = '';
    if (data.replyTo) {
        replyHtml = `<div class="reply-preview">
            <span style="color:${data.replyColor};font-weight:bold">${data.replyColor}</span>: 
            <span>${data.replyText}</span>
        </div>`;
    }

    msgDiv.innerHTML = `
        ${replyHtml}
        <span class="chat-username" style="color:${data.color};background:${data.color}22">${data.color}</span>
        <span>${data.message}</span>
        <button class="reply-btn" title="Reply">....↩️</button>
        
    `;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
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

let replyTo = null;

document.getElementById('chat-box').addEventListener('click', function(e) {
    if (e.target.classList.contains('reply-btn')) {
        const msgDiv = e.target.closest('.chat-message');
        replyTo = {
            msgId: msgDiv.dataset.msgId,
            replyText: msgDiv.querySelector('span:nth-child(2)').textContent,
            replyColor: msgDiv.querySelector('.chat-username').style.color
        };
        showReplyPreview();
    }
});

function showReplyPreview() {
    let preview = document.getElementById('reply-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'reply-preview';
        preview.style.padding = '6px 10px';
        preview.style.background = '#eee';
        preview.style.borderLeft = '4px solid #6c63ff';
        preview.style.marginBottom = '6px';
        preview.style.fontSize = '0.95em';
        document.getElementById('chat-form').prepend(preview);
    }
    preview.innerHTML = `<b style="color:${replyTo.replyColor}">${replyTo.replyColor}</b>: ${replyTo.replyText}
        <button id="cancel-reply" style="float:right;background:none;border:none;cursor:pointer;">✖</button>`;
}

document.getElementById('chat-form').addEventListener('click', function(e){
    if (e.target.id === 'cancel-reply') {
        replyTo = null;
        document.getElementById('reply-preview').remove();
    }
});

let sharingLocation = true;

function startLocationSharing() {
    if (navigator.geolocation && geoWatchId === null) {
        geoWatchId = navigator.geolocation.watchPosition(
            function(position) {
                myLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                socket.emit("send-location", myLocation);
            },
            function(error) {
                console.error(error);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
}

function stopLocationSharing() {
    if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = null;
        socket.emit('stop-location');
    }
}

document.getElementById('toggle-location-btn').addEventListener('click', function() {
    sharingLocation = !sharingLocation;
    this.textContent = sharingLocation ? "Stop Sharing Location" : "Start Sharing Location";
    if (sharingLocation) {
        startLocationSharing();
    } else {
        stopLocationSharing();
    }
});

// On page load, start sharing by default
startLocationSharing();

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    // Haversine formula
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

let miniChatUsers = [];
let miniChatOpen = false;
let miniChatMessages = [];
let miniChatKey = null;

// Helper to get a unique key for the current mini chat group
function getMiniChatKey(users) {
    return 'mini-chat-' + users.map(u => u.id).sort().join('-');
}

// Open mini chat and load messages from localStorage
function openMiniChat(users) {
    miniChatOpen = true;
    miniChatKey = getMiniChatKey(users);
    miniChatMessages = JSON.parse(localStorage.getItem(miniChatKey) || '[]');

    // Request history from server
    socket.emit('mini-chat-history', users.map(u => u.id));

    let chatDiv = document.getElementById('mini-chat');
    if (!chatDiv) {
        chatDiv = document.createElement('div');
        chatDiv.id = 'mini-chat';
        chatDiv.style.position = 'fixed';
        chatDiv.style.bottom = '20px';
        chatDiv.style.right = '20px';
        chatDiv.style.width = '260px';
        chatDiv.style.height = '300px';
        chatDiv.style.background = '#fff';
        chatDiv.style.border = '2px solid #6c63ff';
        chatDiv.style.borderRadius = '12px';
        chatDiv.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
        chatDiv.style.zIndex = 1000;
        chatDiv.innerHTML = `
            <div style="background:#6c63ff;color:#fff;padding:8px 12px;border-radius:10px 10px 0 0;font-weight:bold;">
                Mini Chat (Nearby Users)
                <button id="close-mini-chat" style="float:right;background:none;border:none;color:#fff;font-size:1.2em;cursor:pointer;">×</button>
            </div>
            <div id="mini-chat-messages" style="height:200px;overflow-y:auto;padding:8px;"></div>
            <form id="mini-chat-form" style="display:flex;padding:8px;">
                <input id="mini-chat-input" style="flex:1;padding:4px 8px;border-radius:6px;border:1px solid #ccc;" autocomplete="off" />
                <button type="submit" style="margin-left:6px;padding:4px 10px;border-radius:6px;background:#6c63ff;color:#fff;border:none;">Send</button>
            </form>
        `;
        document.body.appendChild(chatDiv);

        document.getElementById('close-mini-chat').onclick = () => {
            miniChatOpen = false;
            chatDiv.remove();
        };
        document.getElementById('mini-chat-form').onsubmit = function(e) {
            e.preventDefault();
            const msg = document.getElementById('mini-chat-input').value;
            if (msg.trim() !== "") {
                socket.emit('mini-chat-message', { users: miniChatUsers.map(u => u.id), message: msg });
                // miniChatMessages.push({ from: 'me', message: msg, color: 'You' });
                saveMiniChatMessages();
                renderMiniChatMessages();
                document.getElementById('mini-chat-input').value = '';
            }
        };
    }
    renderMiniChatMessages();
    document.getElementById('mini-chat-dot').style.display = 'none';
    showOnlyNearbyMarkers(users);
}

// Render messages in mini chat
function renderMiniChatMessages() {
    let msgBox = document.getElementById('mini-chat-messages');
    if (msgBox) {
        msgBox.innerHTML = '';
        miniChatMessages.forEach(msg => {
            const div = document.createElement('div');
            div.innerHTML = `<b style="color:${msg.color}">${msg.color}</b>: ${msg.message}`;
            msgBox.appendChild(div);
        });
        msgBox.scrollTop = msgBox.scrollHeight;
    }
}

// Save messages to localStorage
function saveMiniChatMessages() {
    if (miniChatKey) {
        localStorage.setItem(miniChatKey, JSON.stringify(miniChatMessages));
    }
}

// On receiving a mini chat message
socket.on('mini-chat-message', function({ from, message, color }) {
    miniChatMessages.push({ from, message, color });
    saveMiniChatMessages();
    if (miniChatOpen) {
        renderMiniChatMessages();
    } else {
        document.getElementById('mini-chat-dot').style.display = 'block';
    }
});

// When mini chat is closed
document.body.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'close-mini-chat') {
        miniChatOpen = false;
        document.getElementById('mini-chat').remove();
        restoreAllMarkers();
    }
});

// When you get nearby users, open the mini chat
socket.on('nearby-users', function(users) {
    miniChatUsers = users;
    openMiniChat(users);
});

document.getElementById('linkup-btn').addEventListener('click', function() {
    if (!myLocation) {
        alert("Location not available yet.");
        return;
    }
    socket.emit('request-nearby-users', myLocation);
});

function sendCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            myLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            socket.emit("send-location", myLocation);
        });
    }
}

Object.values(markers).forEach(marker => {
    if (marker.options.originalColor) {
        marker.setStyle({ color: marker.options.originalColor, fillColor: marker.options.originalColor });
    }
});

let hiddenMarkers = [];

function showOnlyNearbyMarkers(nearbyUsers) {
    const nearbyIds = nearbyUsers.map(u => u.id);
    hiddenMarkers = [];
    Object.entries(markers).forEach(([id, marker]) => {
        if (!nearbyIds.includes(id)) {
            map.removeLayer(marker);
            hiddenMarkers.push(id);
        }
    });
}

function restoreAllMarkers() {
    hiddenMarkers.forEach(id => {
        if (markers[id]) {
            markers[id].addTo(map);
        }
    });
    hiddenMarkers = [];
}

// When history arrives, merge and render
socket.on('mini-chat-history', function(history) {
    // Merge server history with local messages (avoid duplicates)
    const allMsgs = [...history, ...miniChatMessages];
    // Remove duplicates (by message text and sender)
    const uniqueMsgs = [];
    const seen = new Set();
    allMsgs.forEach(msg => {
        const key = msg.from + '|' + msg.message;
        if (!seen.has(key)) {
            uniqueMsgs.push(msg);
            seen.add(key);
        }
    });
    miniChatMessages = uniqueMsgs;
    saveMiniChatMessages();
    renderMiniChatMessages();
});

let chatMediaRecorder;
let chatAudioChunks = [];

document.getElementById('chat-record').addEventListener('click', async function() {
    if (!chatMediaRecorder || chatMediaRecorder.state === "inactive") {
        // Start recording
        if (!navigator.mediaDevices) {
            alert("Audio recording not supported.");
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chatMediaRecorder = new MediaRecorder(stream);
        chatAudioChunks = [];
        chatMediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) chatAudioChunks.push(event.data);
        };
        chatMediaRecorder.onstop = () => {
            const audioBlob = new Blob(chatAudioChunks, { type: 'audio/webm' });
            if (audioBlob.size > 0) {
                const reader = new FileReader();
                reader.onload = function() {
                    socket.emit('chat-voice', {
                        audio: reader.result // base64
                    });
                };
                reader.readAsDataURL(audioBlob);
            }
        };
        chatMediaRecorder.start();
        this.textContent = "⏹️"; // Change icon to stop
        setTimeout(() => {
            if (chatMediaRecorder && chatMediaRecorder.state === "recording") {
                chatMediaRecorder.stop();
                document.getElementById('chat-record').textContent = "🎤";
            }
        }, 10000); // 10 seconds max
    } else if (chatMediaRecorder.state === "recording") {
        // Stop recording early
        chatMediaRecorder.stop();
        this.textContent = "🎤";
    }
});

// Receive and play voice messages in main chat
socket.on('chat-voice', function({ from, audio, color }) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = "chat-message";
    msgDiv.innerHTML = `<span class="chat-username" style="color:${color};background:${color}22">${color}</span>: <audio controls src="${audio}" style="vertical-align:middle;"></audio>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Add a custom control for "My Location" button
L.Control.MyLocation = L.Control.extend({
    onAdd: function(map) {
        const btn = L.DomUtil.create('button', 'leaflet-bar my-location-btn');
        btn.title = "Go to My Location";
        btn.innerHTML = '📍';
        btn.style.width = '36px';
        btn.style.height = '36px';
        btn.style.fontSize = '1.3em';
        btn.style.background = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '50%';
        btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.margin = '8px';

        L.DomEvent.on(btn, 'click', function(e) {
            L.DomEvent.stopPropagation(e);
            if (myLocation) {
                map.setView([myLocation.latitude, myLocation.longitude], 16, { animate: true });
            } else {
                alert("Your location is not available yet.");
            }
        });

        return btn;
    },
    onRemove: function(map) {}
});

// Add the control to the bottom left
L.control.myLocation = function(opts) {
    return new L.Control.MyLocation(opts);
}
L.control.myLocation({ position: 'bottomleft' }).addTo(map);
