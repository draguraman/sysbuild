/* global ace, sysViewModel */

window.LiveEdit = (function () {
    'use strict';

    // LiveEdit class.
    function LiveEdit(editorDivId, _runtime) {
        this.runtime = _runtime;
  
        this.ace = ace.edit(editorDivId);
        this.ace.setTheme('ace/theme/monokai');
        this.ace.getSession().setMode('ace/mode/c_cpp');
        this.viewModel = sysViewModel;

        var updateCompileButton = function() {
            var ready = this.runtime.ready();
            this.viewModel.vmState(ready ? 'Running' : 'Booting');
            this.viewModel.compileStatus(ready ? 'Ready' : 'Waiting');
        }.bind(this);

        updateCompileButton(); // Maybe sys is already up and running
  
        this.runtime.addListener('ready', function() {
            updateCompileButton();
        }.bind(this));
    }

    LiveEdit.prototype.escapeHtml = function (unsafe) {
        /*stackoverflow.com/questions/6234773/*/
        return unsafe
             .replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#039;');
    };

    LiveEdit.prototype.processGccCompletion = function (result) {
        this.viewModel.gccErrorCount(0);
        this.viewModel.gccWarningCount(0);

        if (!result) {
            // cancelled
            this.viewModel.compileStatus('Cancelled');
            return;
        }

        // null if cancelled
        // result = { 'exitcode':gcc_exit_code, 'stats':stats,'annotations':annotations,'gcc_ouput':gcc_output}

        this.runtime.sendKeys('clear\n');
        this.ace.getSession().setAnnotations(result.annotations);

        this.viewModel.lastGccOutput(result.gccOutput);
        this.viewModel.gccErrorCount(result.stats.error);
        this.viewModel.gccWarningCount(result.stats.warning);

        if (result.exitCode === 0) {
            this.viewModel.compileStatus(result.stats.warning > 0 ? 'Warning' : 'Success');
            this.runtime.startProgram('program', this.viewModel.programArgs());
        } else {
            this.viewModel.compileStatus('Failed');
        }
    };

    LiveEdit.prototype.getCodeText = function() {
        return this.ace.getSession().getValue();
    };

    LiveEdit.prototype.runCode = function(code, gccOptions) {
        if(code.length === 0 || code.indexOf('\x03') >= 0 || code.indexOf('\x04') >= 0 ) {
            return;
        }
        var callback = this.processGccCompletion.bind(this);

        this.viewModel.compileStatus('Compiling');

        this.runtime.startGccCompile(code, gccOptions, callback);
    };

    LiveEdit.prototype.setTheme = function (theme) {
        this.ace.setTheme('ace/theme/' + theme);
    };

    return LiveEdit;
})();
