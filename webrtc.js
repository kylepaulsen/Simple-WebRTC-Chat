// start entire script closure.
document.addEventListener('DOMContentLoaded', function() {
"use strict";
// Used these sites for serious help:
// https://sites.google.com/site/muazkh/webrtc-order-the-code
// http://wholcomb.github.io/SimpleSignaling/

// Other cool urls:
// https://github.com/muaz-khan/WebRTC-Experiment
// https://www.webrtc-experiment.com/
// https://github.com/cjb/serverless-webrtc
// http://api.openkeyval.org

if (!window.webkitRTCPeerConnection) {
    alert("Your browser is not supported. Right now only Chrome is... Sorry.");
    return;
}

function $(qry, el) {
    el = el || document;
    return el.querySelector(qry);
}

function listen(el, eventName, func) {
    el.addEventListener(eventName, func, false);
}

var iceServers = {
    iceServers: [{
        url: 'stun:stun.l.google.com:19302'
    }]
};
//var iceServers = null;

var optionalRtpDataChannels = {
    optional: [{
        RtpDataChannels: true
    }]
};

// not needed?
/*
var mediaConstraints = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    }
};
*/

var peerCon;
var peerConDataChannel;

var roomId;

function makeNewPeerConOffer(callback) {
    var offerData = {iceCandidates: []};
    var gotIceServer = false;

    peerCon = new webkitRTCPeerConnection(iceServers, optionalRtpDataChannels);

    // chrome doesnt support reliable connections yet.
    peerConDataChannel = peerCon.createDataChannel('RTCDataChannel', {
        reliable: false
    });

    setChannelEvents(peerConDataChannel);

    peerCon.onicecandidate = function (event) {
        if (!event || !event.candidate) {
            return;
        }
        offerData.iceCandidates.push(event.candidate);
        console.log("ice, ", event.candidate);

        if (!gotIceServer) {
            gotIceServer = true;
            // allow a little more time for ice servers to come in.
            setTimeout(function() {
                console.log("Saving offer...");
                JSONP.post("http://api.openkeyval.org/p2pchat-"+roomId, {data: JSON.stringify(offerData)});
                JSONP.post("http://api.openkeyval.org/p2pchat-"+roomId+"-full", {data: "hasOffer"});
                callback();
            }, 1500);
        }
    };

    peerCon.createOffer(function (description) {
        console.log("Creating offer...");
        peerCon.setLocalDescription(description);
        offerData.offerDesc = description;
    }, function(e) {
        console.log("Could not create offer!", e);
    });
}

function createAnswer() {
    JSONP.get("http://api.openkeyval.org/p2pchat-"+roomId, {}, function(ans) {
        var offerObj;
        var answerData = {iceCandidates: []};
        var gotIceServer = false;

        try {
            offerObj = JSON.parse(ans);
        } catch (e) {
            console.log("There is something wrong with the offer. Not found?");
            return;
        }
        console.log("Got remote offer!");

        peerCon = new webkitRTCPeerConnection(iceServers, optionalRtpDataChannels);

        peerCon.setRemoteDescription(new RTCSessionDescription(offerObj.offerDesc), function() {
            function gotRemoteDescription(desc) {
                peerCon.setLocalDescription(desc);
                answerData.answerDesc = desc;

                console.log("Adding Ice Candidates");
                for (var t=0; t<offerObj.iceCandidates.length; ++t) {
                    peerCon.addIceCandidate(new RTCIceCandidate(offerObj.iceCandidates[t]));
                }
            }

            // The signature is:
            // createAnswer (RTCSessionDescriptionCallback successCallback, RTCPeerConnectionErrorCallback failureCallback, optional MediaConstraints constraints)
            // In chrome, the failure callback is called on connection if successful
            // In firefox, calling with a single argument fails
            try {
                peerCon.createAnswer(gotRemoteDescription);
            } catch(e) {
                peerCon.createAnswer(gotRemoteDescription, function(e) {
                    console.log('could not create answer.', e);
                });
            }
        }, function(e) {
            console.log("could not set remote desc.", e);
        });

        peerCon.onicecandidate = function (event) {
            if (!event || !event.candidate) {
                return;
            }
            answerData.iceCandidates.push(event.candidate);
            console.log("ice, ", event.candidate);

            if (!gotIceServer) {
                gotIceServer = true;
                // allow a little more time for ice servers to come in.
                setTimeout(function() {
                    console.log("Saving answer...");
                    JSONP.post("http://api.openkeyval.org/p2pchat-"+roomId, {data: JSON.stringify(answerData)});
                    JSONP.post("http://api.openkeyval.org/p2pchat-"+roomId+"-full", {data: "hasAnswer"});
                }, 1500);
            }
        };

        peerCon.ondatachannel = function(event) {
            console.log("Got DataChannel!");
            peerConDataChannel = event.channel;
            setChannelEvents(peerConDataChannel);
        };
    });
}

listen($("#createRoomBtn"), "click", function() {
    var numTries = 0;
    if (!roomId) {
        roomId = Math.floor(Math.random()*900000)+100000;
    }
    $("#connectionStuff").innerHTML = "Send this roomID to a friend: <b>"+roomId+"</b><br>Waiting for connection...";

    function checkForPeer() {
        console.log("Checking for peer...");
        JSONP.get("http://api.openkeyval.org/p2pchat-"+roomId+"-full", {}, function(status) {
            if (status === "hasOffer") {
                console.log("Found peer! Getting offer...");
                createAnswer();
            } else {
                if (numTries++ < 10) {
                    console.log("No peer yet. Waiting to check again...");
                    setTimeout(checkForPeer, 5000);
                } else {
                    $("#connectionStuff").innerHTML = "I gave up. Reload.";
                    console.log("I give up!");
                }
            }
        });
    }

    setTimeout(checkForPeer, 5000);
});

listen($("#joinRoomBtn"), "click", function() {
    roomId = $("#roomId").value;
    $("#connectionStuff").innerHTML = "Waiting for connection...";

    function checkForAnswer() {
        console.log("Checking for answer...");
        JSONP.get("http://api.openkeyval.org/p2pchat-"+roomId+"-full", {}, function(status) {
            if (status === "hasAnswer") {
                JSONP.get("http://api.openkeyval.org/p2pchat-"+roomId, {}, function(ans) {
                    console.log("Found answer! Making connection...");
                    var offerObj = JSON.parse(ans);
                    peerCon.setRemoteDescription(new RTCSessionDescription(offerObj.answerDesc), function() {
                        console.log("Adding Ice Candidates");
                        for (var t=0; t<offerObj.iceCandidates.length; ++t) {
                            peerCon.addIceCandidate(new RTCIceCandidate(offerObj.iceCandidates[t]));
                        }
                    });
                });
            } else {
                console.log("No answer yet. Waiting to check again...");
                setTimeout(checkForAnswer, 5000);
            }
        });
    }

    makeNewPeerConOffer(function() {
        setTimeout(checkForAnswer, 5000);
    });
});

function addMessage(msg) {
    var div = $("#msgDiv");
    div.innerHTML += msg + "<br>";
    div.scrollTop = 99999;
}

function sendMessage() {
    var msgBox = $("#msgBox");
    addMessage("<b>You:</b> "+msgBox.value);
    peerConDataChannel.send(msgBox.value);
    msgBox.value = "";
}

function setChannelEvents(channel) {
    channel.onmessage = function (event) {
        console.log('received a message:', event.data);
        addMessage("<b>Other:</b> "+event.data);
    };
    channel.onopen = function () {
        var msgBox = $("#msgBox");
        $("#chatStuff").style.display = "block";
        $("#connectionStuff").style.display = "none";

        addMessage("<b>You have connected to a peer!</b><br>");

        listen(msgBox, "keydown", function(e) {
            if (e.which === 13) {
                sendMessage();
            }
        });

        listen($("#sendBtn"), "click", function() {
            sendMessage();
        });
    };
    channel.onclose = function (e) {
        addMessage("A peer has disconnected!");
        console.error(e);
    };
    channel.onerror = function (e) {
        console.error(e);
    };
    window.onbeforeunload = function() {
        JSONP.post("http://api.openkeyval.org/p2pchat-"+roomId, {data: ""});
        JSONP.post("http://api.openkeyval.org/p2pchat-"+roomId+"-full", {data: ""});
        peerConDataChannel.send("<b>Your peer has disconnected.</b>");
    };
}

// end entire script closure
});
