const socket = io()



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
let shareTimeout = null;

// Send location immediately
function sendCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            socket.emit("send-location", {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            });
        });
    }
}

// Always-running interval, only sends if sharingLocation is true
setInterval(function() {
    if (sharingLocation) {
        sendCurrentLocation();
    }
}, 5000); // every 5 seconds

// Toggle button logic
document.getElementById('toggle-location-btn').addEventListener('click', function() {
    if (sharingLocation) {
        // Stop sharing
        sharingLocation = false;
        this.textContent = "Start Sharing Location";
        if (shareTimeout) {
            clearTimeout(shareTimeout);
            shareTimeout = null;
        }
        socket.emit('stop-location');
    } else {
        // Start sharing
        sharingLocation = true;
        this.textContent = "Stop Sharing Location";
        sendCurrentLocation(); // Send immediately
        // Handle timer if set
        const duration = parseInt(document.getElementById('share-duration').value, 10);
        if (duration > 0) {
           if (shareTimeout) clearTimeout(shareTimeout);
            shareTimeout = setTimeout(() => {
                sharingLocation = false;
                document.getElementById('toggle-location-btn').textContent = "Start Sharing Location";
                socket.emit('stop-location');
            }, duration * 1000);
        }
    }
});

// Duration dropdown logic
document.getElementById('share-duration').addEventListener('change', function() {
    if (sharingLocation) {
        if (shareTimeout) clearTimeout(shareTimeout);
        const duration = parseInt(this.value, 10);
        if (duration > 0) {
            shareTimeout = setTimeout(() => {
                sharingLocation = false;
                document.getElementById('toggle-location-btn').textContent = "Start Sharing Location";
                socket.emit('stop-location');
            }, duration * 1000);
        }
    }
});