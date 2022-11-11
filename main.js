const CANVAS_FAC = 0.8;

class ARCanvas {
    /**
     * 
     * @param {float} modelSize Size of each marker in millimeters
     * @param {int} k Number of markers being used
     */
    constructor(modelSize=150.0, k=10) {
        this.modelSize = modelSize;
        this.setupMarkers(k);
        window.onload = this.initializeVideo.bind(this);
    }

    /**
     * Create a detector and do furthest point sampling
     * in Hamming space to choose markers
     * @param {int} k Number of markers to get
     */
    setupMarkers(k) {
        let detector = new AR.Detector();
        const dictionary = detector.dictionary;
        this.detector = detector;
        let markers = [0];
        const N = dictionary.codeList.length;
        let dists = dictionary.codeList.map(x => dictionary._hammingDistance(x, dictionary.codeList[0]))
        for (let i = 1; i < k; i++) {
            // Step 1: Find the maximum index
            let idx = 0;
            for (let j = 0; j < N; j++) {
                if (dists[j] > dists[idx]) {
                    idx = j;
                }
            }
            markers.push(idx);
            // Step 2: Update distances
            for (let j = 0; j < N; j++) {
                const newDist = dictionary._hammingDistance(dictionary.codeList[idx], dictionary.codeList[j]);
                dists[j] = Math.min(dists[j], newDist);
            }
        }
        markers.sort((a,b) => a-b);
        detector.markers = markers;
        dictionary.codeList = detector.markers.map(i => detector.dictionary.codeList[i]);
    }

    /**
     * Initialize a (back facing) video stream to fill the available window
     * as well as possible
     */
    initializeVideo() {
        const that = this;
        const video = document.getElementById("video");
        this.video = video;
        if (navigator.mediaDevices === undefined) {
            navigator.mediaDevices = {};
        }
        if (navigator.mediaDevices.getUserMedia === undefined) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
                let getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                if (!getUserMedia) {
                    return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
                }
                return new Promise(function(resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            }
        }
        navigator.mediaDevices.getUserMedia({
            video:{
                width: {ideal:window.innerWidth*CANVAS_FAC},
                facingMode: "environment"
            }
        }).then(function(stream) {
            if ("srcObject" in video) {
                video.srcObject = stream;
            }
            else {
                video.src = window.URL.createObjectURL(stream);
            }
            video.onloadeddata = function() {
                that.initializeCanvas();
            }
        }).catch(function(err) {
            console.log(err);
        })
    }

    /**
     * Initialize a canvas to which to draw the video frame,
     * as well as a position tracker object to estimate positions
     * on canvas of the appropriate size
     */
    initializeCanvas() {
        let canvas = document.getElementById("canvas");
        this.canvas = canvas;
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        this.context = canvas.getContext("2d");
        this.posit = new POS.Posit(this.modelSize, canvas.width);
        this.lastTime = new Date();
        this.repaint();
    }

    
    drawCorners(markers){
        if (markers.length > 0) {
            let ids = []
            for (let i = 0; i < markers.length; i++) {
                ids.push(parseInt(markers[i].id));
            }
            ids.sort((a, b) => a - b);
            document.getElementById("detected").innerHTML = "Detected: " + JSON.stringify(ids);
        }
        else {
            document.getElementById("detected").innerHTML = "Detected: []";
        }
        const context = this.context;
        let corners, corner, i, j;
        context.lineWidth = 3;
        for (i = 0; i < markers.length; ++ i){
            corners = markers[i].corners;
            context.strokeStyle = "red";
            context.beginPath();
            for (j = 0; j < corners.length; ++ j){
                corner = corners[j];
                context.moveTo(corner.x, corner.y);
                corner = corners[(j + 1) % corners.length];
                context.lineTo(corner.x, corner.y);
            }
            context.stroke();
            context.closePath();
            context.strokeStyle = "green";
            context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
        }
    }

    repaint() {
        const canvas = this.canvas;
        const video = this.video;
        const context = this.context;
        let thisTime = new Date();
        let elapsed = thisTime - this.lastTime;
        this.lastTime = thisTime;
        console.log(elapsed);
        document.getElementById("fps").innerHTML = Math.round(1000/elapsed) + " fps";
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            let markers = this.detector.detect(imageData);
            this.drawCorners(markers);
        }
        requestAnimationFrame(this.repaint.bind(this));
    }
}