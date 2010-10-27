/*
 * SimThreads: class for searching similar threads when submitting new thread
 */
var SimThreads = {
    simthreads_timer_id: null,
    simthreads_opacity_set: false,
    opacity_min_value: 0.2,
    opacity_max_value: 1,
    current_query: '',

    // contains similar threads HTML object
    simthreads_container: null,

    // contains new thread inputbox object
    inputbox: null,

    // current height of similar threads block
    current_height: 0,
    current_child: '',
    // temporary node used to calculate height
    temp_child:'',

    connection_handler:'',
    animation_speed:0.5,

    /**
     * Onload function, add the handler on inputbox
     */
    init: function() {
        if (AJAX_Compatible)
        {
            SimThreads.simthreads_container = fetch_object('similar_threads');
            if (SimThreads.simthreads_container)
            {
                SimThreads.inputbox = fetch_object('subject');
                if (SimThreads.inputbox)
                {
                    YAHOO.util.Event.on(SimThreads.inputbox, "keyup", SimThreads.handle_keyup);
                    YAHOO.util.Event.on(document, "keydown", SimThreads.handle_body_keyup);
                    SimThreads.current_query = SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
                }
            }
        }
    },

    /**
     * If enter is pressed in subject field - redirect to the search results
     */
    handle_body_keyup: function(event) {
        var elem = event.srcElement? event.srcElement : event.target;
        if (event.keyCode == 13 && elem.id && elem.id == 'subject')
        {
            if (SimThreads.inputbox.value != '')
            {
                YAHOO.util.Event.stopEvent(event);
                SimThreads.moreResults(true);
            }
        }
    },

    /**
     * Restarts the timer on every keypress. Timer is expired when user stopped typing
     * @param event contains the pressed key
     */
    handle_keyup: function(event) {
        clearTimeout(SimThreads.simthreads_timer_id);

        if (SimThreads.current_query !== SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, ''))
        {
            SimThreads.simthreads_timer_id = setTimeout('SimThreads.sendInput()',1000);
            if (!SimThreads.simthreads_opacity_set)
            {
                SimThreads.setOpacity(SimThreads.opacity_min_value);
            }
        }
        else
        {
            SimThreads.setOpacity(SimThreads.opacity_max_value);
        }
    },

    /**
     * Handle expired timer and send data to server
     */
    sendInput: function() {
        clearTimeout(SimThreads.simthreads_timer_id);
        SimThreads.current_query = SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
        if (SimThreads.connection_handler != '')
        {
            YAHOO.util.Connect.abort(SimThreads.connection_handler);
        }

        SimThreads.connection_handler = YAHOO.util.Connect.asyncRequest("POST", "ajax.php?do=find_similar&query=" + SimThreads.current_query
                                                + "&securitytoken=" + SECURITYTOKEN, {
            success: SimThreads.handle_ajax_response,
            failure: vBulletin_AJAX_Error_Handler,
            timeout: vB_Default_Timeout,
            scope: this
        }, SESSIONURL + "securitytoken=" + SECURITYTOKEN + "&do=find_similar&query=" + SimThreads.current_query);
    },

    /**
     * Append invisible node to calculate height
     * @param string_node node code string
     */
    get_height: function(string_node) {
        string_node = string_node.replace('style=""','style="visibility: hidden;"');

        SimThreads.simthreads_container.appendChild(string_to_node(string_node));
        SimThreads.temp_child = SimThreads.simthreads_container.childNodes[SimThreads.simthreads_container.childNodes.length-1];
        var height = 0;
        if (SimThreads.temp_child.offsetHeight)
        {
            height = SimThreads.temp_child.offsetHeight;
        }
        return height;
    },

    /*
     * Set height and opacity of the block before animation
     * @param height of recreated node
     * @param opacity of recreated node
     */
    prepare_animation: function(replacement_node) {
        if (SimThreads.current_child != '')
        {
            // replace to avoid block jumping
            SimThreads.simthreads_container.replaceChild(string_to_node(replacement_node),SimThreads.current_child);
        }
        else
        {
            SimThreads.simthreads_container.appendChild(string_to_node(replacement_node));
        }
        SimThreads.simthreads_container.removeChild(SimThreads.temp_child);
        if (SimThreads.simthreads_container.childNodes[0])
        {
            SimThreads.current_child = SimThreads.simthreads_container.childNodes[0];
        }
    },

    /**
     * Handler server response
     */
    handle_ajax_response: function(ajax) {
        SimThreads.connection_handler = '';
        if (ajax.responseXML)
        {
            // check for error first
            var error = ajax.responseXML.getElementsByTagName('error');
            if (error.length)
            {
                alert(error[0].firstChild.nodeValue);
            }
            else
            {
                var string_node = '';
                var new_simthreads = ajax.responseXML.getElementsByTagName('similar_threads');
                if (new_simthreads.length)
                {
                    string_node = new_simthreads[0].firstChild.nodeValue;
                }

                var height = SimThreads.get_height(string_node);
                SimThreads.prepare_animation(string_node);

                var anim = new YAHOO.util.Anim('similar_threads', { height: {from: SimThreads.current_height, to: height }} , SimThreads.animation_speed);
                anim.onTween.subscribe(function (type,data) { 
                    // we are getting the number of current frame in milliseconds
                    var factor  = data[0].currentFrame / 1000;
                    var animation_step = (SimThreads.opacity_max_value - SimThreads.opacity_min_value) / SimThreads.animation_speed;
                    SimThreads.setOpacity(SimThreads.opacity_min_value + factor*step);
                });
                anim.onComplete.subscribe(function() {SimThreads.setOpacity(SimThreads.opacity_max_value);});
                anim.animate();

                SimThreads.current_height = height;
            }
        }
    },

    /**
     * Redirects to search results for entered thread name
     * @param optional are we displaying results on same page or in new window
     */
    moreResults: function(isSamePage) {
        if (SimThreads.inputbox.value !== '')
        {
            if (isSamePage)
            {
                var pseudoform = new vB_Hidden_Form('search.php?do=process');
                pseudoform.add_variable('type[]', 1);
                pseudoform.add_variable('titleonly', 1);
                pseudoform.add_variable('securitytoken', SECURITYTOKEN);
                pseudoform.add_variable('query', SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, ''));
                pseudoform.add_variable('sortby', 'relevance');
                pseudoform.submit_form();
            }
            else
            {
                window.open(getBaseUrl()+ 'search.php?do=process&type[]=1&titleonly=1&securitytoken=' + SECURITYTOKEN +
                                      '&query='+encodeURIComponent(SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, ''))+'&sortby=relevance');
            }

        }
        return false;
    },

    /**
     * Sets opacity based on browser type
     */
    setOpacity: function(opacity) {
        if (YAHOO.env.ua.ie)
        {
            var oAlpha = SimThreads.simthreads_container.filters['DXImageTransform.Microsoft.alpha'] || SimThreads.simthreads_container.filters.alpha;

            if (oAlpha)
            {
                oAlpha.opacity = opacity*100;
            }
            else
            {
                SimThreads.simthreads_container.style.filter += "progid:DXImageTransform.Microsoft.Alpha(opacity="+opacity*100+")";
            }
        }
        else
        {
            SimThreads.simthreads_container.style.opacity = opacity;
        }

        if (opacity == SimThreads.opacity_max_value)
        {
            SimThreads.simthreads_opacity_set = false;
        }
        else
        {
            SimThreads.simthreads_opacity_set = true;
        }
    }
};