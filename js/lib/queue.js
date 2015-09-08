"use strict";
/**
 * The Queue module. 
 * Takes a max asynchrounous job execution count parameter.
 * A job object gets pushed on to the queue and should have the following:
 * run: the function to be executed.
 * data: the data to be passed to the function.
 * callback: the callback function to be executed after finished job (optional)
 * 
 * The queue is self-contained by executing itself on each job push and job 
 * finish which is executed immediatelly if possible.
 * 
 * @name Queue
 * @copyright Copyright © GhostCom Ltd. 2014 - 2015.
 * @license Apache License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0
 * @author Mickey Joe <mickey@ghostmail.com>
 * @version 3.0
 */

/**
 * Queue constructor.
 * 
 * @param {integer} max
 * @returns {void}
 */
var Queue = function (max) {
    
    /**
     * Current running jobs count.
     * 
     * @type Integer
     */
    var jobsCount = 0;
    
    /**
     * The queue array.
     * 
     * @type Array
     */
    var queue = [];
    
    /**
     * Max asynchrounous job execution count.
     * 
     * @type Integer
     */
    var maxJobs = max;
    
    /**
     * Execute a job if current running jobs count is less than maxJobs.
     * Once a job is finished the queue auto-executes itself.
     * 
     * @returns {void}
     */
    var execute = function() {
        if (jobsCount < maxJobs && queue.length !== 0) {
            var job = queue.pop();
            ++jobsCount;
            if (job.onexecuting) {
                job.onexecuting();
            }
            job.run(job.data, function(result) {
                if (job.oncompleted) {
                    --jobsCount;                    
                    job.oncompleted(jobsCount > 0, result);
                }
                
                execute();
            });
        }
    };
    
    /**
     * Push a job onto the queue and try to execute the job immediatelly.
     * 
     * @param {Object} job
     * @returns {void}
     */
    var push = function(job) {
            queue.push(job);
            execute();
    };
    
    var refresh = function() {
        execute();
    };
    
    // public methods
    return {
        push: push,
        refresh: refresh
    };
};



