/** Creates a function that throttle and debounce events.
 * Basically it allows you to limit throttling time. 
 * @param {Function} options.callback The function to call after debounce & throttle.
 * @param {number} options.maxDelay max time since begining of event-chain, bounce at timeout.
 * @param {number} options.throttleWait time to wait for the next event (while in event-chain).
 * @param {Function} options.controlFunc allows some control over the debounce mechanism, and option to aggregate events, should be lightweight!
 * @param {Function} options.setTimeout allows override the default 'setTimeout' function.
 * @param {Function} options.clearTimeout allows override the default 'clearTimeout' function.
 * @returns {Function} Returns the new debounced function.
 */

function throttledDebounce(options) {
    var setTimeoutFunc = options.setTimeout || setTimeout,
        clearTimeoutFunc = options.clearTimeout || clearTimeout;

    var maxDelayHandle = undefined, //timeout handle for debouncing
        throttleHandle = undefined, //timeout handle for throttling
        didBounce = false, //indicates if event chain just bounced
        throttleTime = undefined, //maxTime to wait to next event
        cancelled = false, //global cancell flag
        context = undefined, //will be passed to 'options.func' and 'options.controlFunc' as a single argument
        gotAnyEvent = false, //indicates whether or not we have something to bounce
        bounce = undefined, //bounce function only for this event-chain
        splitEventChain = false,
        includeLastEventOnSplitting = false;

    function triggerBounce(trigger){
        if(didBounce === false && cancelled === false){
            didBounce = true;
            context.trigger = trigger;

            //keep closure clean, don't want to leak out internal stuff
            if(context.arguments){
                context.arguments = Array.prototype.slice.call(context.arguments);
            }
            delete context.split;

            //actual bounce
            options.callback.call(null, context);
            reset();

            return true;
        }
    }

    //new event-chain
    function reset(){
        gotAnyEvent = false;
        throttleTime = undefined;
        didBounce = false;

        //clear throttleHandle
        if(throttleHandle !== undefined){
            clearTimeoutFunc(throttleHandle);
            throttleHandle = undefined;
        }
        //clear waitHandle
        if(maxDelayHandle !== undefined){
            clearTimeoutFunc(maxDelayHandle);
            maxDelayHandle = undefined;
        }

        var thisContext = {
            callCount: 0,
            arguments: undefined,
            split: function(includeCurrent){
                //prevent cross context calls
                if(context === thisContext && splitEventChain === false){
                    splitEventChain = true;

                    if(includeCurrent === true){
                        includeLastEventOnSplitting = true;
                    }
                    return true;
                }
            }
        };

        bounce = function contextBounce(trigger){
            //prevent cross context calls
            if(context === thisContext){
                return triggerBounce(trigger);
            }
        };

        context = thisContext;
    }

    function setMaxDelay(){
        maxDelayHandle = setTimeoutFunc(maxDelayTimeoutFunc, options.maxDelay);
    }

    function maxDelayTimeoutFunc(){
        maxDelayHandle = undefined;
        bounce('debounce');
    }

    function feedThrottle(){
        var now = (new Date()).getTime();
        if(throttleHandle === undefined){ //first event
            throttleTime = now + options.throttleWait;
            createThrottleTimeout();
        } else {
            var passedTime = throttleTime ? (options.throttleWait-(throttleTime - now)) : 0;
            if(passedTime > 0){
                throttleTime += passedTime; //overtime
            } else {
                //code execution took too long, we've missed our train!
                bounce('throttle');
            }
        }
    }

    function createThrottleTimeout(overrideTime){
        if(overrideTime !== undefined){
            overrideTime = Math.min(options.throttleWait, overrideTime);
        }

        throttleHandle = setTimeoutFunc(feedThrottleTimeoutFunc, overrideTime || options.throttleWait);
    }

    function feedThrottleTimeoutFunc(){
        throttleHandle = undefined;
        var timeLeft = throttleTime - (new Date()).getTime();
        if(timeLeft > 0){
            createThrottleTimeout(timeLeft);
        } else {
            bounce('throttle');
        }
    }

    //this function get called from the 'event-listener'
    function listener(){
        if(cancelled === false){
            gotAnyEvent = true;
            context.callCount++;
            var previousArguments = context.arguments;
            context.arguments = arguments;

            if(options.controlFunc !== undefined){
                var previousSplitEventChain = splitEventChain;
                splitEventChain = false;
                includeLastEventOnSplitting = false;
                //call user callback (can aggregate events and split event-chain)
                options.controlFunc.call(null, context);
                //handle call to 'split' function
                if(splitEventChain === true && previousSplitEventChain === false){ //splitEventChain could be set by the controlFunc
                    if(includeLastEventOnSplitting === false){
                        context.arguments = previousArguments; //fetch previous arguments, before the split
                        context.callCount--;
                    }
                    bounce('control'); //performs a full reset, notice: splitEventChain in not effected
                    if(includeLastEventOnSplitting === false){
                        listener.apply(null, arguments); //inject call, create new event-chain
                    }
                    return; //if splitting, exit function
                }
            }

            feedThrottle();

            if(maxDelayHandle === undefined && options.maxDelay !== undefined){
                setMaxDelay();
            }
        }
    }

    listener.cancel = function cancel(){
        if(cancelled === false){
            cancelled = true;
            reset();
            return true;           
        }
    };

    listener.resume = function resume(){
        if(cancelled === true){
            cancelled = false;
            return true;
        }
    };

    listener.bounce = function globalBounce(force){
        if(force === true || gotAnyEvent === true){
            return triggerBounce('global'); //cancelled flag is checked within function
        }
    };

    reset();
    return listener;
}

//expose as a node module
if(typeof module !== 'undefined'){
    module.exports = throttledDebounce;
}
