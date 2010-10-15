/*
 * SimThreads: class for searching similar threads when submitting new thread
 */
var SimThreads = {
    simthreads_timer_id: null,
    simthreads_opacity_set: false,
    opacity_min_value: 0.2,
    opacity_max_value: 1,
    current_search_word: '',

    // contains similar threads HTML object
    simthreads_container: null,

    // contains new thread inputbox object
    inputbox: null,

    // current height of similar threads block
    current_height: 0,

    // number of similar threads
    num_simthreads: 0,

    // different block heights: tread line, title, more results link and no results found
    thread_block_height: 0,
    thread_title_height: 0,
    thread_more_results_height: 0,
    thread_no_results_height: 0,

    /**
     * Onload function, add the handler on inputbox
     */
    init: function() {
        if (AJAX_Compatible)
        {
            SimThreads.simthreads_containers = fetch_object('similar_threads');
            if (SimThreads.simthreads_containers)
            {
                SimThreads.inputbox = fetch_object('subject');
                if (SimThreads.inputbox)
                {
                    YAHOO.util.Event.on(SimThreads.inputbox, "keyup", SimThreads.handle_keyup);
                }
            }

            // not all browsers have embedded getComputedStyle function
            if (!window.getComputedStyle) {
                window.getComputedStyle = function(el, pseudo) {
                this.el = el;
                this.getPropertyValue = function(prop) {
                    var re = /(\-([a-z]){1})/g;
                    if (prop == 'float') prop = 'styleFloat';
                        if (re.test(prop)) {
                            prop = prop.replace(re, function () {
                            return arguments[2].toUpperCase();
                        });
                    }
                    return el.currentStyle[prop] ? el.currentStyle[prop] : null;
                }
                return this;
                }
            }
        }
    },

    /**
     * Restarts the timer on every keypress. Timer is expired when user stopped typing
     * @param event contains the pressed key
     */
    handle_keyup: function(event) {
        clearTimeout(SimThreads.simthreads_timer_id);

        if (SimThreads.current_search_word !== SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, ''))
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
        SimThreads.current_search_word = SimThreads.inputbox.value.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
        YAHOO.util.Connect.asyncRequest("POST", "ajax.php?do=find_similar&query=" + SimThreads.current_search_word
                                                + "&securitytoken=" + SECURITYTOKEN, {
            success: SimThreads.handle_ajax_response,
            failure: vBulletin_AJAX_Error_Handler,
            timeout: vB_Default_Timeout,
            scope: this
        }, SESSIONURL + "securitytoken=" + SECURITYTOKEN + "&do=find_similar&query=" + SimThreads.current_search_word);
    },

    /**
     * Recreate a node
     * @param string_node node code string
     * @param height of recreated node
     * @param opacity of recreated node
     */
    replace_node: function(string_node, height, opacity) {
        if (height > 0)
        {
            string_node = string_node.replace('style=""','style="height:'+height+'px;"');
        }

        if (opacity >= 0)
        {
            if (YAHOO.env.ua.ie)
            {
                string_node = string_node.replace('style="','style="filter: progid:DXImageTransform.Microsoft.Alpha(opacity='+opacity*100+');');
            }
            else
            {
                string_node = string_node.replace('style="','style="opacity:'+opacity+';');
            }
        }

        SimThreads.simthreads_containers.parentNode.replaceChild(string_to_node(string_node), SimThreads.simthreads_containers);

        // associate updated object with our variable
        SimThreads.simthreads_containers = fetch_object('similar_threads');
    },

    /**
     * Handler server response
     */
    handle_ajax_response: function(ajax) {
        if (ajax.responseXML)
        {
            // check for error first
            var error = ajax.responseXML.getElementsByTagName('error');
            if (error.length)
            {
                alert(error[0].firstChild.nodeValue)
            }
            else
            {
                var num_items = ajax.responseXML.getElementsByTagName('num_items');
                if (num_items.length)
                {
                    SimThreads.num_simthreads = num_items[0].firstChild.nodeValue;
                }

                var is_changed = false;
                var string_node = '';
                var new_simthreads = ajax.responseXML.getElementsByTagName('similar_threads');
                if (new_simthreads.length)
                {
                    string_node = new_simthreads[0].firstChild.nodeValue;
                }
                if (SimThreads.num_simthreads > 0 && SimThreads.thread_block_height == 0 ||
                    SimThreads.num_simthreads == 0 && SimThreads.thread_no_results_height == 0)
                {
                    SimThreads.replace_node(string_node, SimThreads.current_height, -1);
                    
                    if (SimThreads.current_height == 0)
                    {
                        is_changed = true;
                    }
                }
                else
                {
                    SimThreads.replace_node(string_node, SimThreads.getBlockHeight(), SimThreads.opacity_min_value);
                }
                
                var height = SimThreads.getBlockHeight();
                var anim = new YAHOO.util.Anim('similar_threads', { height: {from: SimThreads.current_height, to: height }} , 0.5);
                if (!is_changed)
                {
                    anim.onTween.subscribe(function (type,data) { 
                        var factor  = data[0].currentFrame / 1000;
                        SimThreads.setOpacity(SimThreads.opacity_min_value + factor);
                    });
                    anim.onComplete.subscribe(function() {SimThreads.setOpacity(SimThreads.opacity_max_value);});
                }
                anim.animate();

                if (is_changed)
                {
                    SimThreads.getRealHeight();
                }

                SimThreads.current_height = height;
            }
        }
    },

    /**
     * Redirects to search results for entered thread name
     */
    searchSimthreads: function() {
        if (SimThreads.current_search_word !== '')
        {
            window.open(getBaseUrl()+ 'search.php?do=process&type[]=1&titleonly=1&securitytoken=' + SECURITYTOKEN +
                                      '&query='+encodeURIComponent(SimThreads.current_search_word)+'&sortby=relevance');

        }
        return false;
    },

    /**
     * Sets opacity based on browser type
     */
    setOpacity: function(opacity) {
        if (YAHOO.env.ua.ie)
        {
            var oAlpha = SimThreads.simthreads_containers.filters['DXImageTransform.Microsoft.alpha'] || SimThreads.simthreads_containers.filters.alpha;

            if (oAlpha)
            {
                oAlpha.opacity = opacity*100;
            }
            else
            {
                SimThreads.simthreads_containers.style.filter += "progid:DXImageTransform.Microsoft.Alpha(opacity="+opacity*100+")";
            }
        }
        else
        {
            SimThreads.simthreads_containers.style.opacity = opacity;
        }

        SimThreads.simthreads_opacity_set = !Boolean(opacity);
    },

    /*
     * Calculate block height based on CSS, as our block is not rendered yet to DOM
     */
    getBlockHeight: function() {
        var element_height = 0;
        if (SimThreads.num_simthreads > 0 && SimThreads.thread_block_height == 0 ||
            SimThreads.num_simthreads == 0 && SimThreads.thread_no_results_height == 0)
        {
            if (SimThreads.num_simthreads > 0)
            {
                var font_element = YAHOO.util.Dom.getElementsByClassName("shade", "*", SimThreads.simthreads_containers);
                var cs = window.getComputedStyle(font_element[0], "");
                var font_size = parseInt(cs.getPropertyValue("font-size").replace("px",""));
                var li_element = YAHOO.util.Dom.getElementsByClassName("floatcontainer","li", SimThreads.simthreads_containers);
                cs = window.getComputedStyle(li_element[0], "");
                var paddings = parseInt(cs.getPropertyValue("padding-top").replace("px",""))
                               + parseInt(cs.getPropertyValue("padding-bottom").replace("px",""));
                element_height = (font_size*2 + paddings) * SimThreads.num_simthreads;
                element_height += font_size + paddings;
                
                var option_title = YAHOO.util.Dom.getElementsByClassName("optiontitle", "*", SimThreads.simthreads_containers);
                cs = window.getComputedStyle(option_title[0], "");
                element_height += parseInt(cs.getPropertyValue("font-size").replace("px","")) + parseInt(cs.getPropertyValue("padding-top").replace("px",""))
                                      + parseInt(cs.getPropertyValue("padding-bottom").replace("px",""));

                element_height += element_height/5;
            }
            else
            {
                element_height = 20;
            }
        }
        else
        {
            if (SimThreads.num_simthreads > 0)
            {
                element_height = SimThreads.thread_block_height * SimThreads.num_simthreads + SimThreads.thread_title_height +
                                     SimThreads.thread_more_results_height;
            }
            else
            {
                element_height = SimThreads.thread_no_results_height;
            }
        }
        return element_height;
    },

    /*
     * Calculate real block height based on offsetHeight
     */
    getRealHeight: function() {
        if (SimThreads.num_simthreads > 0)
        {
            var li_element = YAHOO.util.Dom.getElementsByClassName("floatcontainer","li", SimThreads.simthreads_containers);
            SimThreads.thread_block_height = li_element[0].offsetHeight;
            SimThreads.thread_more_results_height = li_element[li_element.length - 1].offsetHeight;

            var title = YAHOO.util.Dom.getElementsByClassName("optiontitle", "*", SimThreads.simthreads_containers);
            SimThreads.thread_title_height = title[0].offsetHeight;
        }
        else
        {
            var li_element = YAHOO.util.Dom.getElementsByClassName("similar_threads","ol", SimThreads.simthreads_containers);
            SimThreads.thread_no_results_height = li_element[0].offsetHeight;
        }
    }
};