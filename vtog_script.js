// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;


function onSuccess() { };
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // We're connected to the room and received an array of 'members'
  // connected to the room (including us). Signaling server is ready.
  room.on('members', members => {
    console.log('MEMBERS', members);
    // If we are the second user to connect to the room we will be creating the offer
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

var video_tag = document.getElementById("video_tag");

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({ 'candidate': event.candidate });
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true,
  }).then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  // Listen to signaling data from Scaledrone
  room.on('data', (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // When receiving an offer lets answer it
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    } else if (message.video_info) {
      // console.log(message.video_info);

      date = new Date()
      time_other = message.video_info[0] - message.video_info[1] / 1000 + date.getTime() / 1000;
      console.log(time_other);
      console.log(video_tag.currentTime);
      if (message.video_info[2] == true) { video_tag.play(); }
      if (message.video_info[3] == true) { video_tag.pause(); }
      if (message.video_info[4] == true) { video_tag.currentTime = time_other; }
      if (message.video_info[5] == true) { video_tag.currentTime += 29; }
      if (message.video_info[6] == true) { video_tag.currentTime -= 7; }

      // if (message.video_info[2] == true) {
      //   video_tag.pause();
      //   console.log("paused!");
      // }
      // if (message.video_info[2] == false && video_tag.paused == true) {
      //   video_tag.play();
      //   console.log("played!");
      // }

      // if (Math.abs(time_other - video_tag.currentTime) > 3) {
      //   if(time_other < video_tag.currentTime) {
      //     if(message.video_info[2] == true && video_tag.paused == false) {
      //       video_tag.pause();
      //       console.log("paused!");
      //     }
      //     if(message.video_info[2] == false && video_tag.paused == true) {
      //       video_tag.play();
      //       console.log("played!");
      //     }
      //   }
      // }

      // if (Math.abs(time_other - video_tag.currentTime) > 10) {
      //   if (time_other < video_tag.currentTime) {
      //     video_tag.currentTime = time_other;
      //     console.log("time freshed!");
      //   }
      // }
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({ 'sdp': pc.localDescription }),
    onError
  );
}

{/* <button id="play">play</button>
  <button id="pause">pause</button>
  <button id="calibrate">calibrate</button>
  <button id="jump_up">jump 13sec up</button>
  <button id="jump_back">jump 7sec back</button> */}

var play = document.getElementById("play");
var is_play = false
play.addEventListener('click', (event) => { is_play = true; video_tag.play(); })
var pause = document.getElementById("pause");
var is_pause = false
pause.addEventListener('click', (event) => { is_pause = true; video_tag.pause(); })
var calibrate = document.getElementById("calibrate");
var is_calibrate = false
calibrate.addEventListener('click', (event) => { is_calibrate = true; })
var jump_up = document.getElementById("jump_up");
var is_jump_up = false
jump_up.addEventListener('click', (event) => { is_jump_up = true; video_tag.currentTime += 29; })
var jump_back = document.getElementById("jump_back");
var is_jump_back = false
jump_back.addEventListener('click', (event) => { is_jump_back = true; video_tag.currentTime -= 7; })

window.setInterval(function () {
  date = new Date()
  // video info format
  //
  sendMessage({ 'video_info': [video_tag.currentTime, date.getTime(), is_play, is_pause, is_calibrate, is_jump_up, is_jump_back] });
  is_play = false;
  is_pause = false;
  is_calibrate = false;
  is_jump_up = false;
  is_jump_back = false;
}, 250);