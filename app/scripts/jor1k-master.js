/* global Terminal, TerminalInput, Ethernet, sysViewModel */

window.Jor1kGUI = (function () {
    'use strict';

    /*
    function DebugMessage(message) {
        console.log(message);
    }*/

    function UARTDev(worker) {
        this.ReceiveChar = function (c) {
            if (worker.lastMouseDownTarget !== worker.fbcanvas) {
                worker.sendToWorker('tty0', c);
            }
        };
    }

    function Jor1kGUI(termid, fbid, statsid, imageurls, relayURL) {
        this.urls = imageurls;

        this.worker = new Worker('jor1k/js/worker/worker.js');
        this.worker.onmessage = this.onMessage.bind(this);
        this.worker.onerror = function (e) {
            console.log('Error at ' + e.filename + ':' + e.lineno + ': ' + e.message);
        };
        
        this.sendToWorker = function (command, data) {
            this.worker.postMessage(
            {
                command: command,
                data: data
            });
        };

        this.reset = function () {
            this.stop = false; // VM Stopped/Aborted
            this.userpaused = false;
            this.executepending=false; // if we rec an execute message while paused      
            this.sendToWorker('Reset');
            this.sendToWorker('LoadAndStart', this.urls);
            this.term.PauseBlink(false);
        };

        this.pause = function (pause) {
            pause = !!pause; // coerce to boolean
            if (pause === this.userpaused) {
                return;
            }
            this.userpaused = pause;
            if(! this.userpaused && this.executepending) {
                this.executepending = false;
                this.sendToWorker('execute', 0);
            }
            this.term.PauseBlink(pause);
        };

        this.terminalcanvas = document.getElementById(termid);

        this.term = new Terminal(24, 80, termid);
        this.terminput = new TerminalInput(new UARTDev(this));

        this.ignoreKeys = function () {
            //Simpler but not as general, return( document.activeElement.type==="textarea" || document.activeElement.type==='input');
            return ((this.lastMouseDownTarget !== this.terminalcanvas));
        };

        var recordTarget = function (event) {
            this.lastMouseDownTarget = event.target;
        }.bind(this);
          
        if(document.addEventListener) {
            document.addEventListener('mousedown', recordTarget, false);
        } else {
            window.onmousedown = recordTarget; // IE 10 support (untested)
        }

        document.onkeypress = function (event) {
            if(this.ignoreKeys()) {
                return true;
            }
            this.sendToWorker('keypress', {keyCode:event.keyCode, charCode:event.charCode});
            return this.terminput.OnKeyPress(event);
        }.bind(this);

        document.onkeydown = function (event) {
            if(this.ignoreKeys()) {
                return true;
            }
            this.sendToWorker('keydown', {keyCode:event.keyCode, charCode:event.charCode});
            return this.terminput.OnKeyDown(event);
        }.bind(this);

        document.onkeyup = function (event) {
            if(this.ignoreKeys()) {
                return true;
            }
            this.sendToWorker('keyup', {keyCode:event.keyCode, charCode:event.charCode});
            return this.terminput.OnKeyUp(event);
        }.bind(this);

        this.ethernet = new Ethernet(relayURL);
        this.ethernet.onmessage = function (e) {
            this.sendToWorker('ethmac', e.data);
        }.bind(this);
        
        this.reset();

        window.setInterval(function (){
            this.sendToWorker('GetIPS', 0);
        }.bind(this), 1000);
    }

    Jor1kGUI.prototype.onMessage = function (e) {
        if (this.stop) {
            return;
        }
        switch(e.data.command) {
            case 'execute':  // this command is send back and forth to be responsive
                if(this.userpaused) {
                    this.executepending = true;
                } else {
                    this.executepending = false;
                    this.sendToWorker('execute', 0);
                }
                break;
            case 'ethmac':
                this.ethernet.SendFrame(e.data.data);
                break;
            case 'tty0':
                this.term.PutChar(e.data.data);
                break;
            case 'Stop':
                console.log('Received stop signal');
                this.stop = true;
                break;
            case 'GetIPS':
                //this.stats.innerHTML = this.userpaused ? "Paused" : ;
                sysViewModel.vmMips(this.userpaused ? 0 : (Math.floor(e.data.data/100000)/10.0));
                break;
            case 'Debug':
                console.log(e.data.data);
                break;
        }
    };

    return Jor1kGUI;

})();
