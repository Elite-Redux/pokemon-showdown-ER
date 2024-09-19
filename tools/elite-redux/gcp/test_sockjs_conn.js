const sockjs = require("sockjs-client");

const sock = sockjs("http://stately-planet-436000-q5.web.app:8080/showdown");
sock.onopen = function () {
	console.log("open");
	sock.send("test");
};

sock.onmessage = function (e) {
	console.log("message", e.data);
	sock.close();
};

sock.onclose = function () {
	console.log("close");
};
