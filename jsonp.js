/*
* Lightweight JSONP fetcher
* Copyright 2010-2012 Erik Karlsson. All rights reserved.
* BSD licensed
*/


/*
* Usage:
*
* JSONP.get( 'someUrl.php', {param1:'123', param2:'456'}, function(data){
*   //do something with data, which is the JSON object you should retrieve from someUrl.php
* });
*/
var JSONP = (function() {
    "use strict";
    var counter = 0, head, config = {};
    function load(url, pfnError) {
        var script = document.createElement('script'),
            done = false;
        script.src = url;
        script.async = true;

        var errorHandler = pfnError || config.error;
        if ( typeof errorHandler === 'function' ) {
            script.onerror = function(ex){
                errorHandler({url: url, event: ex});
            };
        }

        script.onload = script.onreadystatechange = function() {
            if ( !done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") ) {
                done = true;
                script.onload = script.onreadystatechange = null;
                if ( script && script.parentNode ) {
                    script.parentNode.removeChild( script );
                }
            }
        };

        if ( !head ) {
            head = document.getElementsByTagName('head')[0];
        }
        head.appendChild( script );
    }
    function encode(str) {
        return encodeURIComponent(str);
    }
    function jsonp(url, params, callback, callbackName) {
        var query = (url||'').indexOf('?') === -1 ? '?' : '&', key;

        callbackName = (callbackName||config.callbackName||'callback');
        var uniqueName = callbackName + "_json" + (++counter);

        params = params || {};
        for ( key in params ) {
            if ( params.hasOwnProperty(key) ) {
                query += encode(key) + "=" + encode(params[key]) + "&";
            }
        }

        window[ uniqueName ] = function(data){
            callback(data);
            try {
                delete window[ uniqueName ];
            } catch (e) {}
            window[ uniqueName ] = null;
        };

        load(url + query + callbackName + '=' + uniqueName);
        return uniqueName;
    }
    function setDefaults(obj) {
        config = obj;
    }
    function post(url, params) {
        var iframe = document.createElement('iframe');
        var iframeName = "tempPostingIframe" + Math.floor(Math.random()*999999);
        var iframeFirstLoad = true;
        iframe.style.display = "none";
        iframe.name = iframeName;
        iframe.onload = function() {
            if (!iframeFirstLoad) {
                iframe.parentNode.removeChild(iframe);
            }
            iframeFirstLoad = false;
        };
        document.body.appendChild(iframe);

        var form = document.createElement('form');
        form.action = url;
        form.method = "post";
        form.target = iframeName;

        var input;
        for (var key in params) {
            if ( params.hasOwnProperty(key) ) {
                input = document.createElement("input");
                input.type = "text";
                input.name = key;
                input.value = params[key];
                form.appendChild(input);
            }
        }

        form.submit();
    }
    return {
        get:jsonp,
        post:post,
        init:setDefaults
    };
}());
