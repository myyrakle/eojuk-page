
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.38.3 */

    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (37:21) {#each database as option}
    function create_each_block_2(ctx) {
    	let option;
    	let t_value = /*option*/ ctx[15].view + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*option*/ ctx[15].value;
    			option.value = option.__value;
    			add_location(option, file, 37, 24, 932);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*database*/ 1 && t_value !== (t_value = /*option*/ ctx[15].view + "")) set_data_dev(t, t_value);

    			if (dirty & /*database*/ 1 && option_value_value !== (option_value_value = /*option*/ ctx[15].value)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(37:21) {#each database as option}",
    		ctx
    	});

    	return block;
    }

    // (47:21) {#each orm as option}
    function create_each_block_1(ctx) {
    	let option;
    	let t_value = /*option*/ ctx[15].view + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*option*/ ctx[15].value;
    			option.value = option.__value;
    			add_location(option, file, 47, 24, 1351);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*orm*/ 2 && t_value !== (t_value = /*option*/ ctx[15].view + "")) set_data_dev(t, t_value);

    			if (dirty & /*orm*/ 2 && option_value_value !== (option_value_value = /*option*/ ctx[15].value)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(47:21) {#each orm as option}",
    		ctx
    	});

    	return block;
    }

    // (54:21) {#each fieldname as option}
    function create_each_block(ctx) {
    	let option;
    	let t_value = /*option*/ ctx[15].view + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*option*/ ctx[15].value;
    			option.value = option.__value;
    			add_location(option, file, 54, 24, 1653);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fieldname*/ 4 && t_value !== (t_value = /*option*/ ctx[15].view + "")) set_data_dev(t, t_value);

    			if (dirty & /*fieldname*/ 4 && option_value_value !== (option_value_value = /*option*/ ctx[15].value)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(54:21) {#each fieldname as option}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let hr;
    	let t0;
    	let div4;
    	let div1;
    	let div0;
    	let select0;
    	let t1;
    	let br0;
    	let t2;
    	let textarea0;
    	let t3;
    	let div3;
    	let div2;
    	let select1;
    	let t4;
    	let select2;
    	let t5;
    	let br1;
    	let t6;
    	let textarea1;
    	let t7;
    	let div5;
    	let button;
    	let t9;
    	let br2;
    	let br3;
    	let t10;
    	let br4;
    	let t11;
    	let textarea2;
    	let mounted;
    	let dispose;
    	let each_value_2 = /*database*/ ctx[0];
    	validate_each_argument(each_value_2);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*orm*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*fieldname*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			hr = element("hr");
    			t0 = space();
    			div4 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t1 = space();
    			br0 = element("br");
    			t2 = space();
    			textarea0 = element("textarea");
    			t3 = space();
    			div3 = element("div");
    			div2 = element("div");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t4 = space();
    			select2 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			br1 = element("br");
    			t6 = space();
    			textarea1 = element("textarea");
    			t7 = space();
    			div5 = element("div");
    			button = element("button");
    			button.textContent = "변환";
    			t9 = space();
    			br2 = element("br");
    			br3 = element("br");
    			t10 = text("\n\n        Error Log ");
    			br4 = element("br");
    			t11 = space();
    			textarea2 = element("textarea");
    			add_location(hr, file, 31, 4, 696);
    			attr_dev(select0, "id", "left-select");
    			if (/*selectedDatabase*/ ctx[3] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[11].call(select0));
    			add_location(select0, file, 35, 16, 805);
    			add_location(br0, file, 39, 18, 1038);
    			attr_dev(textarea0, "class", "top-textarea svelte-7hdm6x");
    			add_location(textarea0, file, 40, 16, 1061);
    			attr_dev(div0, "class", "left-inner svelte-7hdm6x");
    			add_location(div0, file, 34, 12, 764);
    			attr_dev(div1, "class", "left svelte-7hdm6x");
    			add_location(div1, file, 33, 8, 733);
    			attr_dev(select1, "id", "right-select");
    			if (/*selectedOrm*/ ctx[4] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[13].call(select1));
    			add_location(select1, file, 45, 16, 1233);
    			attr_dev(select2, "id", "right-select-fieldname");
    			if (/*selectedFieldname*/ ctx[5] === void 0) add_render_callback(() => /*select2_change_handler*/ ctx[14].call(select2));
    			add_location(select2, file, 50, 16, 1473);
    			add_location(br1, file, 57, 16, 1775);
    			textarea1.readOnly = true;
    			attr_dev(textarea1, "class", "top-textarea svelte-7hdm6x");
    			textarea1.value = /*rightText*/ ctx[7];
    			add_location(textarea1, file, 58, 16, 1798);
    			attr_dev(div2, "class", "right-inner svelte-7hdm6x");
    			add_location(div2, file, 44, 12, 1191);
    			attr_dev(div3, "class", "right svelte-7hdm6x");
    			add_location(div3, file, 43, 8, 1159);
    			attr_dev(div4, "class", "top svelte-7hdm6x");
    			add_location(div4, file, 32, 4, 707);
    			add_location(button, file, 63, 8, 1939);
    			add_location(br2, file, 63, 55, 1986);
    			add_location(br3, file, 63, 61, 1992);
    			add_location(br4, file, 65, 18, 2018);
    			textarea2.readOnly = true;
    			attr_dev(textarea2, "id", "error-textarea");
    			textarea2.value = /*errorLog*/ ctx[8];
    			attr_dev(textarea2, "class", "svelte-7hdm6x");
    			add_location(textarea2, file, 66, 8, 2033);
    			attr_dev(div5, "class", "bottom svelte-7hdm6x");
    			add_location(div5, file, 62, 4, 1910);
    			add_location(main, file, 30, 0, 685);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, hr);
    			append_dev(main, t0);
    			append_dev(main, div4);
    			append_dev(div4, div1);
    			append_dev(div1, div0);
    			append_dev(div0, select0);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(select0, null);
    			}

    			select_option(select0, /*selectedDatabase*/ ctx[3]);
    			append_dev(div0, t1);
    			append_dev(div0, br0);
    			append_dev(div0, t2);
    			append_dev(div0, textarea0);
    			set_input_value(textarea0, /*leftText*/ ctx[6]);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, select1);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select1, null);
    			}

    			select_option(select1, /*selectedOrm*/ ctx[4]);
    			append_dev(div2, t4);
    			append_dev(div2, select2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select2, null);
    			}

    			select_option(select2, /*selectedFieldname*/ ctx[5]);
    			append_dev(div2, t5);
    			append_dev(div2, br1);
    			append_dev(div2, t6);
    			append_dev(div2, textarea1);
    			append_dev(main, t7);
    			append_dev(main, div5);
    			append_dev(div5, button);
    			append_dev(div5, t9);
    			append_dev(div5, br2);
    			append_dev(div5, br3);
    			append_dev(div5, t10);
    			append_dev(div5, br4);
    			append_dev(div5, t11);
    			append_dev(div5, textarea2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[11]),
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[12]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[13]),
    					listen_dev(select2, "change", /*select2_change_handler*/ ctx[14]),
    					listen_dev(button, "click", /*onButtonClicked*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*database*/ 1) {
    				each_value_2 = /*database*/ ctx[0];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(select0, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_2.length;
    			}

    			if (dirty & /*selectedDatabase, database*/ 9) {
    				select_option(select0, /*selectedDatabase*/ ctx[3]);
    			}

    			if (dirty & /*leftText*/ 64) {
    				set_input_value(textarea0, /*leftText*/ ctx[6]);
    			}

    			if (dirty & /*orm*/ 2) {
    				each_value_1 = /*orm*/ ctx[1];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*selectedOrm, orm*/ 18) {
    				select_option(select1, /*selectedOrm*/ ctx[4]);
    			}

    			if (dirty & /*fieldname*/ 4) {
    				each_value = /*fieldname*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*selectedFieldname, fieldname*/ 36) {
    				select_option(select2, /*selectedFieldname*/ ctx[5]);
    			}

    			if (dirty & /*rightText*/ 128) {
    				prop_dev(textarea1, "value", /*rightText*/ ctx[7]);
    			}

    			if (dirty & /*errorLog*/ 256) {
    				prop_dev(textarea2, "value", /*errorLog*/ ctx[8]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	
    	let { database } = $$props;
    	let { orm } = $$props;
    	let { fieldname } = $$props;
    	let { convert } = $$props;
    	let selectedDatabase = null;
    	let selectedOrm = null;
    	let selectedFieldname = null;
    	let leftText = "";
    	let rightText = "";
    	let errorLog = "";

    	function onButtonClicked() {
    		if (selectedDatabase === null) {
    			alert("데이터베이스를 선택해주세요.");
    			return;
    		}

    		if (selectedOrm === null) {
    			alert("ORM을 선택해주세요.");
    			return;
    		}

    		try {
    			$$invalidate(7, rightText = convert(leftText, selectedDatabase, selectedOrm, selectedFieldname));
    		} catch(error) {
    			alert("오류 발생");
    			$$invalidate(8, errorLog = JSON.stringify(error));
    		}
    	}

    	const writable_props = ["database", "orm", "fieldname", "convert"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function select0_change_handler() {
    		selectedDatabase = select_value(this);
    		$$invalidate(3, selectedDatabase);
    		$$invalidate(0, database);
    	}

    	function textarea0_input_handler() {
    		leftText = this.value;
    		$$invalidate(6, leftText);
    	}

    	function select1_change_handler() {
    		selectedOrm = select_value(this);
    		$$invalidate(4, selectedOrm);
    		$$invalidate(1, orm);
    	}

    	function select2_change_handler() {
    		selectedFieldname = select_value(this);
    		$$invalidate(5, selectedFieldname);
    		$$invalidate(2, fieldname);
    	}

    	$$self.$$set = $$props => {
    		if ("database" in $$props) $$invalidate(0, database = $$props.database);
    		if ("orm" in $$props) $$invalidate(1, orm = $$props.orm);
    		if ("fieldname" in $$props) $$invalidate(2, fieldname = $$props.fieldname);
    		if ("convert" in $$props) $$invalidate(10, convert = $$props.convert);
    	};

    	$$self.$capture_state = () => ({
    		database,
    		orm,
    		fieldname,
    		convert,
    		selectedDatabase,
    		selectedOrm,
    		selectedFieldname,
    		leftText,
    		rightText,
    		errorLog,
    		onButtonClicked
    	});

    	$$self.$inject_state = $$props => {
    		if ("database" in $$props) $$invalidate(0, database = $$props.database);
    		if ("orm" in $$props) $$invalidate(1, orm = $$props.orm);
    		if ("fieldname" in $$props) $$invalidate(2, fieldname = $$props.fieldname);
    		if ("convert" in $$props) $$invalidate(10, convert = $$props.convert);
    		if ("selectedDatabase" in $$props) $$invalidate(3, selectedDatabase = $$props.selectedDatabase);
    		if ("selectedOrm" in $$props) $$invalidate(4, selectedOrm = $$props.selectedOrm);
    		if ("selectedFieldname" in $$props) $$invalidate(5, selectedFieldname = $$props.selectedFieldname);
    		if ("leftText" in $$props) $$invalidate(6, leftText = $$props.leftText);
    		if ("rightText" in $$props) $$invalidate(7, rightText = $$props.rightText);
    		if ("errorLog" in $$props) $$invalidate(8, errorLog = $$props.errorLog);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		database,
    		orm,
    		fieldname,
    		selectedDatabase,
    		selectedOrm,
    		selectedFieldname,
    		leftText,
    		rightText,
    		errorLog,
    		onButtonClicked,
    		convert,
    		select0_change_handler,
    		textarea0_input_handler,
    		select1_change_handler,
    		select2_change_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			database: 0,
    			orm: 1,
    			fieldname: 2,
    			convert: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*database*/ ctx[0] === undefined && !("database" in props)) {
    			console.warn("<App> was created without expected prop 'database'");
    		}

    		if (/*orm*/ ctx[1] === undefined && !("orm" in props)) {
    			console.warn("<App> was created without expected prop 'orm'");
    		}

    		if (/*fieldname*/ ctx[2] === undefined && !("fieldname" in props)) {
    			console.warn("<App> was created without expected prop 'fieldname'");
    		}

    		if (/*convert*/ ctx[10] === undefined && !("convert" in props)) {
    			console.warn("<App> was created without expected prop 'convert'");
    		}
    	}

    	get database() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set database(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get orm() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orm(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fieldname() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fieldname(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get convert() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set convert(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function getAugmentedNamespace(n) {
    	if (n.__esModule) return n;
    	var a = Object.defineProperty({}, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var moo = createCommonjsModule(function (module) {
    (function(root, factory) {
      if (module.exports) {
        module.exports = factory();
      } else {
        root.moo = factory();
      }
    }(commonjsGlobal, function() {

      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var toString = Object.prototype.toString;
      var hasSticky = typeof new RegExp().sticky === 'boolean';

      /***************************************************************************/

      function isRegExp(o) { return o && toString.call(o) === '[object RegExp]' }
      function isObject(o) { return o && typeof o === 'object' && !isRegExp(o) && !Array.isArray(o) }

      function reEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      }
      function reGroups(s) {
        var re = new RegExp('|' + s);
        return re.exec('').length - 1
      }
      function reCapture(s) {
        return '(' + s + ')'
      }
      function reUnion(regexps) {
        if (!regexps.length) return '(?!)'
        var source =  regexps.map(function(s) {
          return "(?:" + s + ")"
        }).join('|');
        return "(?:" + source + ")"
      }

      function regexpOrLiteral(obj) {
        if (typeof obj === 'string') {
          return '(?:' + reEscape(obj) + ')'

        } else if (isRegExp(obj)) {
          // TODO: consider /u support
          if (obj.ignoreCase) throw new Error('RegExp /i flag not allowed')
          if (obj.global) throw new Error('RegExp /g flag is implied')
          if (obj.sticky) throw new Error('RegExp /y flag is implied')
          if (obj.multiline) throw new Error('RegExp /m flag is implied')
          return obj.source

        } else {
          throw new Error('Not a pattern: ' + obj)
        }
      }

      function objectToRules(object) {
        var keys = Object.getOwnPropertyNames(object);
        var result = [];
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var thing = object[key];
          var rules = [].concat(thing);
          if (key === 'include') {
            for (var j = 0; j < rules.length; j++) {
              result.push({include: rules[j]});
            }
            continue
          }
          var match = [];
          rules.forEach(function(rule) {
            if (isObject(rule)) {
              if (match.length) result.push(ruleOptions(key, match));
              result.push(ruleOptions(key, rule));
              match = [];
            } else {
              match.push(rule);
            }
          });
          if (match.length) result.push(ruleOptions(key, match));
        }
        return result
      }

      function arrayToRules(array) {
        var result = [];
        for (var i = 0; i < array.length; i++) {
          var obj = array[i];
          if (obj.include) {
            var include = [].concat(obj.include);
            for (var j = 0; j < include.length; j++) {
              result.push({include: include[j]});
            }
            continue
          }
          if (!obj.type) {
            throw new Error('Rule has no type: ' + JSON.stringify(obj))
          }
          result.push(ruleOptions(obj.type, obj));
        }
        return result
      }

      function ruleOptions(type, obj) {
        if (!isObject(obj)) {
          obj = { match: obj };
        }
        if (obj.include) {
          throw new Error('Matching rules cannot also include states')
        }

        // nb. error and fallback imply lineBreaks
        var options = {
          defaultType: type,
          lineBreaks: !!obj.error || !!obj.fallback,
          pop: false,
          next: null,
          push: null,
          error: false,
          fallback: false,
          value: null,
          type: null,
          shouldThrow: false,
        };

        // Avoid Object.assign(), so we support IE9+
        for (var key in obj) {
          if (hasOwnProperty.call(obj, key)) {
            options[key] = obj[key];
          }
        }

        // type transform cannot be a string
        if (typeof options.type === 'string' && type !== options.type) {
          throw new Error("Type transform cannot be a string (type '" + options.type + "' for token '" + type + "')")
        }

        // convert to array
        var match = options.match;
        options.match = Array.isArray(match) ? match : match ? [match] : [];
        options.match.sort(function(a, b) {
          return isRegExp(a) && isRegExp(b) ? 0
               : isRegExp(b) ? -1 : isRegExp(a) ? +1 : b.length - a.length
        });
        return options
      }

      function toRules(spec) {
        return Array.isArray(spec) ? arrayToRules(spec) : objectToRules(spec)
      }

      var defaultErrorRule = ruleOptions('error', {lineBreaks: true, shouldThrow: true});
      function compileRules(rules, hasStates) {
        var errorRule = null;
        var fast = Object.create(null);
        var fastAllowed = true;
        var unicodeFlag = null;
        var groups = [];
        var parts = [];

        // If there is a fallback rule, then disable fast matching
        for (var i = 0; i < rules.length; i++) {
          if (rules[i].fallback) {
            fastAllowed = false;
          }
        }

        for (var i = 0; i < rules.length; i++) {
          var options = rules[i];

          if (options.include) {
            // all valid inclusions are removed by states() preprocessor
            throw new Error('Inheritance is not allowed in stateless lexers')
          }

          if (options.error || options.fallback) {
            // errorRule can only be set once
            if (errorRule) {
              if (!options.fallback === !errorRule.fallback) {
                throw new Error("Multiple " + (options.fallback ? "fallback" : "error") + " rules not allowed (for token '" + options.defaultType + "')")
              } else {
                throw new Error("fallback and error are mutually exclusive (for token '" + options.defaultType + "')")
              }
            }
            errorRule = options;
          }

          var match = options.match.slice();
          if (fastAllowed) {
            while (match.length && typeof match[0] === 'string' && match[0].length === 1) {
              var word = match.shift();
              fast[word.charCodeAt(0)] = options;
            }
          }

          // Warn about inappropriate state-switching options
          if (options.pop || options.push || options.next) {
            if (!hasStates) {
              throw new Error("State-switching options are not allowed in stateless lexers (for token '" + options.defaultType + "')")
            }
            if (options.fallback) {
              throw new Error("State-switching options are not allowed on fallback tokens (for token '" + options.defaultType + "')")
            }
          }

          // Only rules with a .match are included in the RegExp
          if (match.length === 0) {
            continue
          }
          fastAllowed = false;

          groups.push(options);

          // Check unicode flag is used everywhere or nowhere
          for (var j = 0; j < match.length; j++) {
            var obj = match[j];
            if (!isRegExp(obj)) {
              continue
            }

            if (unicodeFlag === null) {
              unicodeFlag = obj.unicode;
            } else if (unicodeFlag !== obj.unicode && options.fallback === false) {
              throw new Error('If one rule is /u then all must be')
            }
          }

          // convert to RegExp
          var pat = reUnion(match.map(regexpOrLiteral));

          // validate
          var regexp = new RegExp(pat);
          if (regexp.test("")) {
            throw new Error("RegExp matches empty string: " + regexp)
          }
          var groupCount = reGroups(pat);
          if (groupCount > 0) {
            throw new Error("RegExp has capture groups: " + regexp + "\nUse (?: … ) instead")
          }

          // try and detect rules matching newlines
          if (!options.lineBreaks && regexp.test('\n')) {
            throw new Error('Rule should declare lineBreaks: ' + regexp)
          }

          // store regex
          parts.push(reCapture(pat));
        }


        // If there's no fallback rule, use the sticky flag so we only look for
        // matches at the current index.
        //
        // If we don't support the sticky flag, then fake it using an irrefutable
        // match (i.e. an empty pattern).
        var fallbackRule = errorRule && errorRule.fallback;
        var flags = hasSticky && !fallbackRule ? 'ym' : 'gm';
        var suffix = hasSticky || fallbackRule ? '' : '|';

        if (unicodeFlag === true) flags += "u";
        var combined = new RegExp(reUnion(parts) + suffix, flags);
        return {regexp: combined, groups: groups, fast: fast, error: errorRule || defaultErrorRule}
      }

      function compile(rules) {
        var result = compileRules(toRules(rules));
        return new Lexer({start: result}, 'start')
      }

      function checkStateGroup(g, name, map) {
        var state = g && (g.push || g.next);
        if (state && !map[state]) {
          throw new Error("Missing state '" + state + "' (in token '" + g.defaultType + "' of state '" + name + "')")
        }
        if (g && g.pop && +g.pop !== 1) {
          throw new Error("pop must be 1 (in token '" + g.defaultType + "' of state '" + name + "')")
        }
      }
      function compileStates(states, start) {
        var all = states.$all ? toRules(states.$all) : [];
        delete states.$all;

        var keys = Object.getOwnPropertyNames(states);
        if (!start) start = keys[0];

        var ruleMap = Object.create(null);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          ruleMap[key] = toRules(states[key]).concat(all);
        }
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var rules = ruleMap[key];
          var included = Object.create(null);
          for (var j = 0; j < rules.length; j++) {
            var rule = rules[j];
            if (!rule.include) continue
            var splice = [j, 1];
            if (rule.include !== key && !included[rule.include]) {
              included[rule.include] = true;
              var newRules = ruleMap[rule.include];
              if (!newRules) {
                throw new Error("Cannot include nonexistent state '" + rule.include + "' (in state '" + key + "')")
              }
              for (var k = 0; k < newRules.length; k++) {
                var newRule = newRules[k];
                if (rules.indexOf(newRule) !== -1) continue
                splice.push(newRule);
              }
            }
            rules.splice.apply(rules, splice);
            j--;
          }
        }

        var map = Object.create(null);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          map[key] = compileRules(ruleMap[key], true);
        }

        for (var i = 0; i < keys.length; i++) {
          var name = keys[i];
          var state = map[name];
          var groups = state.groups;
          for (var j = 0; j < groups.length; j++) {
            checkStateGroup(groups[j], name, map);
          }
          var fastKeys = Object.getOwnPropertyNames(state.fast);
          for (var j = 0; j < fastKeys.length; j++) {
            checkStateGroup(state.fast[fastKeys[j]], name, map);
          }
        }

        return new Lexer(map, start)
      }

      function keywordTransform(map) {
        var reverseMap = Object.create(null);
        var byLength = Object.create(null);
        var types = Object.getOwnPropertyNames(map);
        for (var i = 0; i < types.length; i++) {
          var tokenType = types[i];
          var item = map[tokenType];
          var keywordList = Array.isArray(item) ? item : [item];
          keywordList.forEach(function(keyword) {
            (byLength[keyword.length] = byLength[keyword.length] || []).push(keyword);
            if (typeof keyword !== 'string') {
              throw new Error("keyword must be string (in keyword '" + tokenType + "')")
            }
            reverseMap[keyword] = tokenType;
          });
        }

        // fast string lookup
        // https://jsperf.com/string-lookups
        function str(x) { return JSON.stringify(x) }
        var source = '';
        source += 'switch (value.length) {\n';
        for (var length in byLength) {
          var keywords = byLength[length];
          source += 'case ' + length + ':\n';
          source += 'switch (value) {\n';
          keywords.forEach(function(keyword) {
            var tokenType = reverseMap[keyword];
            source += 'case ' + str(keyword) + ': return ' + str(tokenType) + '\n';
          });
          source += '}\n';
        }
        source += '}\n';
        return Function('value', source) // type
      }

      /***************************************************************************/

      var Lexer = function(states, state) {
        this.startState = state;
        this.states = states;
        this.buffer = '';
        this.stack = [];
        this.reset();
      };

      Lexer.prototype.reset = function(data, info) {
        this.buffer = data || '';
        this.index = 0;
        this.line = info ? info.line : 1;
        this.col = info ? info.col : 1;
        this.queuedToken = info ? info.queuedToken : null;
        this.queuedThrow = info ? info.queuedThrow : null;
        this.setState(info ? info.state : this.startState);
        this.stack = info && info.stack ? info.stack.slice() : [];
        return this
      };

      Lexer.prototype.save = function() {
        return {
          line: this.line,
          col: this.col,
          state: this.state,
          stack: this.stack.slice(),
          queuedToken: this.queuedToken,
          queuedThrow: this.queuedThrow,
        }
      };

      Lexer.prototype.setState = function(state) {
        if (!state || this.state === state) return
        this.state = state;
        var info = this.states[state];
        this.groups = info.groups;
        this.error = info.error;
        this.re = info.regexp;
        this.fast = info.fast;
      };

      Lexer.prototype.popState = function() {
        this.setState(this.stack.pop());
      };

      Lexer.prototype.pushState = function(state) {
        this.stack.push(this.state);
        this.setState(state);
      };

      var eat = hasSticky ? function(re, buffer) { // assume re is /y
        return re.exec(buffer)
      } : function(re, buffer) { // assume re is /g
        var match = re.exec(buffer);
        // will always match, since we used the |(?:) trick
        if (match[0].length === 0) {
          return null
        }
        return match
      };

      Lexer.prototype._getGroup = function(match) {
        var groupCount = this.groups.length;
        for (var i = 0; i < groupCount; i++) {
          if (match[i + 1] !== undefined) {
            return this.groups[i]
          }
        }
        throw new Error('Cannot find token type for matched text')
      };

      function tokenToString() {
        return this.value
      }

      Lexer.prototype.next = function() {
        var index = this.index;

        // If a fallback token matched, we don't need to re-run the RegExp
        if (this.queuedGroup) {
          var token = this._token(this.queuedGroup, this.queuedText, index);
          this.queuedGroup = null;
          this.queuedText = "";
          return token
        }

        var buffer = this.buffer;
        if (index === buffer.length) {
          return // EOF
        }

        // Fast matching for single characters
        var group = this.fast[buffer.charCodeAt(index)];
        if (group) {
          return this._token(group, buffer.charAt(index), index)
        }

        // Execute RegExp
        var re = this.re;
        re.lastIndex = index;
        var match = eat(re, buffer);

        // Error tokens match the remaining buffer
        var error = this.error;
        if (match == null) {
          return this._token(error, buffer.slice(index, buffer.length), index)
        }

        var group = this._getGroup(match);
        var text = match[0];

        if (error.fallback && match.index !== index) {
          this.queuedGroup = group;
          this.queuedText = text;

          // Fallback tokens contain the unmatched portion of the buffer
          return this._token(error, buffer.slice(index, match.index), index)
        }

        return this._token(group, text, index)
      };

      Lexer.prototype._token = function(group, text, offset) {
        // count line breaks
        var lineBreaks = 0;
        if (group.lineBreaks) {
          var matchNL = /\n/g;
          var nl = 1;
          if (text === '\n') {
            lineBreaks = 1;
          } else {
            while (matchNL.exec(text)) { lineBreaks++; nl = matchNL.lastIndex; }
          }
        }

        var token = {
          type: (typeof group.type === 'function' && group.type(text)) || group.defaultType,
          value: typeof group.value === 'function' ? group.value(text) : text,
          text: text,
          toString: tokenToString,
          offset: offset,
          lineBreaks: lineBreaks,
          line: this.line,
          col: this.col,
        };
        // nb. adding more props to token object will make V8 sad!

        var size = text.length;
        this.index += size;
        this.line += lineBreaks;
        if (lineBreaks !== 0) {
          this.col = size - nl + 1;
        } else {
          this.col += size;
        }

        // throw, if no rule with {error: true}
        if (group.shouldThrow) {
          throw new Error(this.formatError(token, "invalid syntax"))
        }

        if (group.pop) this.popState();
        else if (group.push) this.pushState(group.push);
        else if (group.next) this.setState(group.next);

        return token
      };

      if (typeof Symbol !== 'undefined' && Symbol.iterator) {
        var LexerIterator = function(lexer) {
          this.lexer = lexer;
        };

        LexerIterator.prototype.next = function() {
          var token = this.lexer.next();
          return {value: token, done: !token}
        };

        LexerIterator.prototype[Symbol.iterator] = function() {
          return this
        };

        Lexer.prototype[Symbol.iterator] = function() {
          return new LexerIterator(this)
        };
      }

      Lexer.prototype.formatError = function(token, message) {
        if (token == null) {
          // An undefined token indicates EOF
          var text = this.buffer.slice(this.index);
          var token = {
            text: text,
            offset: this.index,
            lineBreaks: text.indexOf('\n') === -1 ? 0 : 1,
            line: this.line,
            col: this.col,
          };
        }
        var start = Math.max(0, token.offset - token.col + 1);
        var eol = token.lineBreaks ? token.text.indexOf('\n') : token.text.length;
        var firstLine = this.buffer.substring(start, token.offset + eol);
        message += " at line " + token.line + " col " + token.col + ":\n\n";
        message += "  " + firstLine + "\n";
        message += "  " + Array(token.col).join(" ") + "^";
        return message
      };

      Lexer.prototype.clone = function() {
        return new Lexer(this.states, this.state)
      };

      Lexer.prototype.has = function(tokenType) {
        return true
      };


      return {
        compile: compile,
        states: compileStates,
        error: Object.freeze({error: true}),
        fallback: Object.freeze({fallback: true}),
        keywords: keywordTransform,
      }

    }));
    });

    var nearley = createCommonjsModule(function (module) {
    (function(root, factory) {
        if (module.exports) {
            module.exports = factory();
        } else {
            root.nearley = factory();
        }
    }(commonjsGlobal, function() {

        function Rule(name, symbols, postprocess) {
            this.id = ++Rule.highestId;
            this.name = name;
            this.symbols = symbols;        // a list of literal | regex class | nonterminal
            this.postprocess = postprocess;
            return this;
        }
        Rule.highestId = 0;

        Rule.prototype.toString = function(withCursorAt) {
            var symbolSequence = (typeof withCursorAt === "undefined")
                                 ? this.symbols.map(getSymbolShortDisplay).join(' ')
                                 : (   this.symbols.slice(0, withCursorAt).map(getSymbolShortDisplay).join(' ')
                                     + " ● "
                                     + this.symbols.slice(withCursorAt).map(getSymbolShortDisplay).join(' ')     );
            return this.name + " → " + symbolSequence;
        };


        // a State is a rule at a position from a given starting point in the input stream (reference)
        function State(rule, dot, reference, wantedBy) {
            this.rule = rule;
            this.dot = dot;
            this.reference = reference;
            this.data = [];
            this.wantedBy = wantedBy;
            this.isComplete = this.dot === rule.symbols.length;
        }

        State.prototype.toString = function() {
            return "{" + this.rule.toString(this.dot) + "}, from: " + (this.reference || 0);
        };

        State.prototype.nextState = function(child) {
            var state = new State(this.rule, this.dot + 1, this.reference, this.wantedBy);
            state.left = this;
            state.right = child;
            if (state.isComplete) {
                state.data = state.build();
                // Having right set here will prevent the right state and its children
                // form being garbage collected
                state.right = undefined;
            }
            return state;
        };

        State.prototype.build = function() {
            var children = [];
            var node = this;
            do {
                children.push(node.right.data);
                node = node.left;
            } while (node.left);
            children.reverse();
            return children;
        };

        State.prototype.finish = function() {
            if (this.rule.postprocess) {
                this.data = this.rule.postprocess(this.data, this.reference, Parser.fail);
            }
        };


        function Column(grammar, index) {
            this.grammar = grammar;
            this.index = index;
            this.states = [];
            this.wants = {}; // states indexed by the non-terminal they expect
            this.scannable = []; // list of states that expect a token
            this.completed = {}; // states that are nullable
        }


        Column.prototype.process = function(nextColumn) {
            var states = this.states;
            var wants = this.wants;
            var completed = this.completed;

            for (var w = 0; w < states.length; w++) { // nb. we push() during iteration
                var state = states[w];

                if (state.isComplete) {
                    state.finish();
                    if (state.data !== Parser.fail) {
                        // complete
                        var wantedBy = state.wantedBy;
                        for (var i = wantedBy.length; i--; ) { // this line is hot
                            var left = wantedBy[i];
                            this.complete(left, state);
                        }

                        // special-case nullables
                        if (state.reference === this.index) {
                            // make sure future predictors of this rule get completed.
                            var exp = state.rule.name;
                            (this.completed[exp] = this.completed[exp] || []).push(state);
                        }
                    }

                } else {
                    // queue scannable states
                    var exp = state.rule.symbols[state.dot];
                    if (typeof exp !== 'string') {
                        this.scannable.push(state);
                        continue;
                    }

                    // predict
                    if (wants[exp]) {
                        wants[exp].push(state);

                        if (completed.hasOwnProperty(exp)) {
                            var nulls = completed[exp];
                            for (var i = 0; i < nulls.length; i++) {
                                var right = nulls[i];
                                this.complete(state, right);
                            }
                        }
                    } else {
                        wants[exp] = [state];
                        this.predict(exp);
                    }
                }
            }
        };

        Column.prototype.predict = function(exp) {
            var rules = this.grammar.byName[exp] || [];

            for (var i = 0; i < rules.length; i++) {
                var r = rules[i];
                var wantedBy = this.wants[exp];
                var s = new State(r, 0, this.index, wantedBy);
                this.states.push(s);
            }
        };

        Column.prototype.complete = function(left, right) {
            var copy = left.nextState(right);
            this.states.push(copy);
        };


        function Grammar(rules, start) {
            this.rules = rules;
            this.start = start || this.rules[0].name;
            var byName = this.byName = {};
            this.rules.forEach(function(rule) {
                if (!byName.hasOwnProperty(rule.name)) {
                    byName[rule.name] = [];
                }
                byName[rule.name].push(rule);
            });
        }

        // So we can allow passing (rules, start) directly to Parser for backwards compatibility
        Grammar.fromCompiled = function(rules, start) {
            var lexer = rules.Lexer;
            if (rules.ParserStart) {
              start = rules.ParserStart;
              rules = rules.ParserRules;
            }
            var rules = rules.map(function (r) { return (new Rule(r.name, r.symbols, r.postprocess)); });
            var g = new Grammar(rules, start);
            g.lexer = lexer; // nb. storing lexer on Grammar is iffy, but unavoidable
            return g;
        };


        function StreamLexer() {
          this.reset("");
        }

        StreamLexer.prototype.reset = function(data, state) {
            this.buffer = data;
            this.index = 0;
            this.line = state ? state.line : 1;
            this.lastLineBreak = state ? -state.col : 0;
        };

        StreamLexer.prototype.next = function() {
            if (this.index < this.buffer.length) {
                var ch = this.buffer[this.index++];
                if (ch === '\n') {
                  this.line += 1;
                  this.lastLineBreak = this.index;
                }
                return {value: ch};
            }
        };

        StreamLexer.prototype.save = function() {
          return {
            line: this.line,
            col: this.index - this.lastLineBreak,
          }
        };

        StreamLexer.prototype.formatError = function(token, message) {
            // nb. this gets called after consuming the offending token,
            // so the culprit is index-1
            var buffer = this.buffer;
            if (typeof buffer === 'string') {
                var lines = buffer
                    .split("\n")
                    .slice(
                        Math.max(0, this.line - 5), 
                        this.line
                    );

                buffer.indexOf('\n', this.index);
                var col = this.index - this.lastLineBreak;
                var lastLineDigits = String(this.line).length;
                message += " at line " + this.line + " col " + col + ":\n\n";
                message += lines
                    .map(function(line, i) {
                        return pad(this.line - lines.length + i + 1, lastLineDigits) + " " + line;
                    }, this)
                    .join("\n");
                message += "\n" + pad("", lastLineDigits + col) + "^\n";
                return message;
            } else {
                return message + " at index " + (this.index - 1);
            }

            function pad(n, length) {
                var s = String(n);
                return Array(length - s.length + 1).join(" ") + s;
            }
        };

        function Parser(rules, start, options) {
            if (rules instanceof Grammar) {
                var grammar = rules;
                var options = start;
            } else {
                var grammar = Grammar.fromCompiled(rules, start);
            }
            this.grammar = grammar;

            // Read options
            this.options = {
                keepHistory: false,
                lexer: grammar.lexer || new StreamLexer,
            };
            for (var key in (options || {})) {
                this.options[key] = options[key];
            }

            // Setup lexer
            this.lexer = this.options.lexer;
            this.lexerState = undefined;

            // Setup a table
            var column = new Column(grammar, 0);
            this.table = [column];

            // I could be expecting anything.
            column.wants[grammar.start] = [];
            column.predict(grammar.start);
            // TODO what if start rule is nullable?
            column.process();
            this.current = 0; // token index
        }

        // create a reserved token for indicating a parse fail
        Parser.fail = {};

        Parser.prototype.feed = function(chunk) {
            var lexer = this.lexer;
            lexer.reset(chunk, this.lexerState);

            var token;
            while (true) {
                try {
                    token = lexer.next();
                    if (!token) {
                        break;
                    }
                } catch (e) {
                    // Create the next column so that the error reporter
                    // can display the correctly predicted states.
                    var nextColumn = new Column(this.grammar, this.current + 1);
                    this.table.push(nextColumn);
                    var err = new Error(this.reportLexerError(e));
                    err.offset = this.current;
                    err.token = e.token;
                    throw err;
                }
                // We add new states to table[current+1]
                var column = this.table[this.current];

                // GC unused states
                if (!this.options.keepHistory) {
                    delete this.table[this.current - 1];
                }

                var n = this.current + 1;
                var nextColumn = new Column(this.grammar, n);
                this.table.push(nextColumn);

                // Advance all tokens that expect the symbol
                var literal = token.text !== undefined ? token.text : token.value;
                var value = lexer.constructor === StreamLexer ? token.value : token;
                var scannable = column.scannable;
                for (var w = scannable.length; w--; ) {
                    var state = scannable[w];
                    var expect = state.rule.symbols[state.dot];
                    // Try to consume the token
                    // either regex or literal
                    if (expect.test ? expect.test(value) :
                        expect.type ? expect.type === token.type
                                    : expect.literal === literal) {
                        // Add it
                        var next = state.nextState({data: value, token: token, isToken: true, reference: n - 1});
                        nextColumn.states.push(next);
                    }
                }

                // Next, for each of the rules, we either
                // (a) complete it, and try to see if the reference row expected that
                //     rule
                // (b) predict the next nonterminal it expects by adding that
                //     nonterminal's start state
                // To prevent duplication, we also keep track of rules we have already
                // added

                nextColumn.process();

                // If needed, throw an error:
                if (nextColumn.states.length === 0) {
                    // No states at all! This is not good.
                    var err = new Error(this.reportError(token));
                    err.offset = this.current;
                    err.token = token;
                    throw err;
                }

                // maybe save lexer state
                if (this.options.keepHistory) {
                  column.lexerState = lexer.save();
                }

                this.current++;
            }
            if (column) {
              this.lexerState = lexer.save();
            }

            // Incrementally keep track of results
            this.results = this.finish();

            // Allow chaining, for whatever it's worth
            return this;
        };

        Parser.prototype.reportLexerError = function(lexerError) {
            var tokenDisplay, lexerMessage;
            // Planning to add a token property to moo's thrown error
            // even on erroring tokens to be used in error display below
            var token = lexerError.token;
            if (token) {
                tokenDisplay = "input " + JSON.stringify(token.text[0]) + " (lexer error)";
                lexerMessage = this.lexer.formatError(token, "Syntax error");
            } else {
                tokenDisplay = "input (lexer error)";
                lexerMessage = lexerError.message;
            }
            return this.reportErrorCommon(lexerMessage, tokenDisplay);
        };

        Parser.prototype.reportError = function(token) {
            var tokenDisplay = (token.type ? token.type + " token: " : "") + JSON.stringify(token.value !== undefined ? token.value : token);
            var lexerMessage = this.lexer.formatError(token, "Syntax error");
            return this.reportErrorCommon(lexerMessage, tokenDisplay);
        };

        Parser.prototype.reportErrorCommon = function(lexerMessage, tokenDisplay) {
            var lines = [];
            lines.push(lexerMessage);
            var lastColumnIndex = this.table.length - 2;
            var lastColumn = this.table[lastColumnIndex];
            var expectantStates = lastColumn.states
                .filter(function(state) {
                    var nextSymbol = state.rule.symbols[state.dot];
                    return nextSymbol && typeof nextSymbol !== "string";
                });

            if (expectantStates.length === 0) {
                lines.push('Unexpected ' + tokenDisplay + '. I did not expect any more input. Here is the state of my parse table:\n');
                this.displayStateStack(lastColumn.states, lines);
            } else {
                lines.push('Unexpected ' + tokenDisplay + '. Instead, I was expecting to see one of the following:\n');
                // Display a "state stack" for each expectant state
                // - which shows you how this state came to be, step by step.
                // If there is more than one derivation, we only display the first one.
                var stateStacks = expectantStates
                    .map(function(state) {
                        return this.buildFirstStateStack(state, []) || [state];
                    }, this);
                // Display each state that is expecting a terminal symbol next.
                stateStacks.forEach(function(stateStack) {
                    var state = stateStack[0];
                    var nextSymbol = state.rule.symbols[state.dot];
                    var symbolDisplay = this.getSymbolDisplay(nextSymbol);
                    lines.push('A ' + symbolDisplay + ' based on:');
                    this.displayStateStack(stateStack, lines);
                }, this);
            }
            lines.push("");
            return lines.join("\n");
        };
        
        Parser.prototype.displayStateStack = function(stateStack, lines) {
            var lastDisplay;
            var sameDisplayCount = 0;
            for (var j = 0; j < stateStack.length; j++) {
                var state = stateStack[j];
                var display = state.rule.toString(state.dot);
                if (display === lastDisplay) {
                    sameDisplayCount++;
                } else {
                    if (sameDisplayCount > 0) {
                        lines.push('    ^ ' + sameDisplayCount + ' more lines identical to this');
                    }
                    sameDisplayCount = 0;
                    lines.push('    ' + display);
                }
                lastDisplay = display;
            }
        };

        Parser.prototype.getSymbolDisplay = function(symbol) {
            return getSymbolLongDisplay(symbol);
        };

        /*
        Builds a the first state stack. You can think of a state stack as the call stack
        of the recursive-descent parser which the Nearley parse algorithm simulates.
        A state stack is represented as an array of state objects. Within a
        state stack, the first item of the array will be the starting
        state, with each successive item in the array going further back into history.

        This function needs to be given a starting state and an empty array representing
        the visited states, and it returns an single state stack.

        */
        Parser.prototype.buildFirstStateStack = function(state, visited) {
            if (visited.indexOf(state) !== -1) {
                // Found cycle, return null
                // to eliminate this path from the results, because
                // we don't know how to display it meaningfully
                return null;
            }
            if (state.wantedBy.length === 0) {
                return [state];
            }
            var prevState = state.wantedBy[0];
            var childVisited = [state].concat(visited);
            var childResult = this.buildFirstStateStack(prevState, childVisited);
            if (childResult === null) {
                return null;
            }
            return [state].concat(childResult);
        };

        Parser.prototype.save = function() {
            var column = this.table[this.current];
            column.lexerState = this.lexerState;
            return column;
        };

        Parser.prototype.restore = function(column) {
            var index = column.index;
            this.current = index;
            this.table[index] = column;
            this.table.splice(index + 1);
            this.lexerState = column.lexerState;

            // Incrementally keep track of results
            this.results = this.finish();
        };

        // nb. deprecated: use save/restore instead!
        Parser.prototype.rewind = function(index) {
            if (!this.options.keepHistory) {
                throw new Error('set option `keepHistory` to enable rewinding')
            }
            // nb. recall column (table) indicies fall between token indicies.
            //        col 0   --   token 0   --   col 1
            this.restore(this.table[index]);
        };

        Parser.prototype.finish = function() {
            // Return the possible parsings
            var considerations = [];
            var start = this.grammar.start;
            var column = this.table[this.table.length - 1];
            column.states.forEach(function (t) {
                if (t.rule.name === start
                        && t.dot === t.rule.symbols.length
                        && t.reference === 0
                        && t.data !== Parser.fail) {
                    considerations.push(t);
                }
            });
            return considerations.map(function(c) {return c.data; });
        };

        function getSymbolLongDisplay(symbol) {
            var type = typeof symbol;
            if (type === "string") {
                return symbol;
            } else if (type === "object") {
                if (symbol.literal) {
                    return JSON.stringify(symbol.literal);
                } else if (symbol instanceof RegExp) {
                    return 'character matching ' + symbol;
                } else if (symbol.type) {
                    return symbol.type + ' token';
                } else if (symbol.test) {
                    return 'token matching ' + String(symbol.test);
                } else {
                    throw new Error('Unknown symbol type: ' + symbol);
                }
            }
        }

        function getSymbolShortDisplay(symbol) {
            var type = typeof symbol;
            if (type === "string") {
                return symbol;
            } else if (type === "object") {
                if (symbol.literal) {
                    return JSON.stringify(symbol.literal);
                } else if (symbol instanceof RegExp) {
                    return symbol.toString();
                } else if (symbol.type) {
                    return '%' + symbol.type;
                } else if (symbol.test) {
                    return '<' + String(symbol.test) + '>';
                } else {
                    throw new Error('Unknown symbol type: ' + symbol);
                }
            }
        }

        return {
            Parser: Parser,
            Grammar: Grammar,
            Rule: Rule,
        };

    }));
    });

    var pgsqlAstParser = createCommonjsModule(function (module, exports) {
    (function(e, a) { for(var i in a) e[i] = a[i]; }(exports, /******/ (function(modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};
    /******/
    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {
    /******/
    /******/ 		// Check if module is in cache
    /******/ 		if(installedModules[moduleId]) {
    /******/ 			return installedModules[moduleId].exports;
    /******/ 		}
    /******/ 		// Create a new module (and put it into the cache)
    /******/ 		var module = installedModules[moduleId] = {
    /******/ 			i: moduleId,
    /******/ 			l: false,
    /******/ 			exports: {}
    /******/ 		};
    /******/
    /******/ 		// Execute the module function
    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    /******/
    /******/ 		// Flag the module as loaded
    /******/ 		module.l = true;
    /******/
    /******/ 		// Return the exports of the module
    /******/ 		return module.exports;
    /******/ 	}
    /******/
    /******/
    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;
    /******/
    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;
    /******/
    /******/ 	// define getter function for harmony exports
    /******/ 	__webpack_require__.d = function(exports, name, getter) {
    /******/ 		if(!__webpack_require__.o(exports, name)) {
    /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
    /******/ 		}
    /******/ 	};
    /******/
    /******/ 	// define __esModule on exports
    /******/ 	__webpack_require__.r = function(exports) {
    /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    /******/ 		}
    /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
    /******/ 	};
    /******/
    /******/ 	// create a fake namespace object
    /******/ 	// mode & 1: value is a module id, require it
    /******/ 	// mode & 2: merge all properties of value into the ns
    /******/ 	// mode & 4: return value when already ns object
    /******/ 	// mode & 8|1: behave like require
    /******/ 	__webpack_require__.t = function(value, mode) {
    /******/ 		if(mode & 1) value = __webpack_require__(value);
    /******/ 		if(mode & 8) return value;
    /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
    /******/ 		var ns = Object.create(null);
    /******/ 		__webpack_require__.r(ns);
    /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
    /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
    /******/ 		return ns;
    /******/ 	};
    /******/
    /******/ 	// getDefaultExport function for compatibility with non-harmony modules
    /******/ 	__webpack_require__.n = function(module) {
    /******/ 		var getter = module && module.__esModule ?
    /******/ 			function getDefault() { return module['default']; } :
    /******/ 			function getModuleExports() { return module; };
    /******/ 		__webpack_require__.d(getter, 'a', getter);
    /******/ 		return getter;
    /******/ 	};
    /******/
    /******/ 	// Object.prototype.hasOwnProperty.call
    /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
    /******/
    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";
    /******/
    /******/
    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(__webpack_require__.s = 7);
    /******/ })
    /************************************************************************/
    /******/ ([
    /* 0 */
    /***/ (function(module, exports) {

    module.exports = moo;

    /***/ }),
    /* 1 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.unbox = exports.box = exports.track = exports.tracking = exports.trackingComments = exports.lexerAny = exports.lexer = void 0;
    const moo_1 = __webpack_require__(0);
    const keywords_1 = __webpack_require__(3);
    // build keywords
    const keywodsMap = {};
    for (const k of keywords_1.sqlKeywords) {
        keywodsMap['kw_' + k.toLowerCase()] = k;
    }
    const caseInsensitiveKeywords = (map) => {
        const transform = moo_1.keywords(map);
        return (text) => transform(text.toUpperCase());
    };
    // build lexer
    exports.lexer = moo_1.compile({
        word: {
            match: /[eE](?!')[A-Za-z0-9_]*|[a-df-zA-DF-Z_][A-Za-z0-9_]*/,
            type: caseInsensitiveKeywords(keywodsMap),
            value: x => x.toLowerCase(),
        },
        wordQuoted: {
            match: /"(?:[^"\*]|"")+"/,
            type: () => 'word',
        },
        string: {
            match: /'(?:[^']|\'\')*'/,
            value: x => {
                return x.substr(1, x.length - 2)
                    .replace(/''/g, '\'');
            },
        },
        eString: {
            match: /\b(?:e|E)'(?:[^'\\]|[\r\n\s]|(?:\\\s)|(?:\\\n)|(?:\\.)|(?:\'\'))+'/,
            value: x => {
                return x.substr(2, x.length - 3)
                    .replace(/''/g, '\'')
                    .replace(/\\([\s\n])/g, (_, x) => x)
                    .replace(/\\./g, m => JSON.parse('"' + m + '"'));
            },
        },
        qparam: {
            match: /\$\d+/,
        },
        star: '*',
        comma: ',',
        space: { match: /[\s\t\n\v\f\r]+/, lineBreaks: true, },
        int: /\-?\d+(?![\.\d])/,
        float: /\-?(?:(?:\d*\.\d+)|(?:\d+\.\d*))/,
        // word: /[a-zA-Z][A-Za-z0-9_\-]*/,
        commentLine: /\-\-.*?$[\s\r\n]*/,
        commentFull: /(?<!\/)\/\*(?:.|[\r\n])*?\*\/[\s\r\n]*/,
        lparen: '(',
        rparen: ')',
        lbracket: '[',
        rbracket: ']',
        semicolon: ';',
        dot: /\.(?!\d)/,
        op_cast: '::',
        op_plus: '+',
        op_eq: '=',
        op_neq: {
            match: /(?:!=)|(?:\<\>)/,
            value: () => '!=',
        },
        op_minus: /(?<!\-)\-(?!\-)(?!\>)/,
        op_div: /(?<!\/)\/(?!\/)/,
        op_like: /(?<!\!)~~(?!\*)/,
        op_ilike: /(?<!\!)~~\*/,
        op_not_like: /\!~~(?!\*)/,
        op_not_ilike: /\!~~\*/,
        op_mod: '%',
        op_exp: '^',
        op_member: /\-\>(?!\>)/,
        op_membertext: '->>',
        op_additive: {
            // group other additive operators
            match: ['||', '-', '#-', '&&'],
        },
        op_compare: {
            // group other comparison operators
            // ... to add: "IN" and "NOT IN" that are matched by keywords
            match: ['>', '>=', '<', '<=', '@>', '<@', '?', '?|', '?&', '#>>', '>>', '<<', '~'],
        },
        ops_others: {
            // referenced as (any other operator) in https://www.postgresql.org/docs/12/sql-syntax-lexical.html#SQL-PRECEDENCE
            // see also https://www.postgresql.org/docs/9.0/functions-math.html
            match: ['|', '&', '^', '#'],
        },
        codeblock: {
            match: /\$\$(?:.|[\s\t\n\v\f\r])*?\$\$/s,
            lineBreaks: true,
            value: (x) => x.substr(2, x.length - 4),
        },
    });
    exports.lexer.next = (next => () => {
        let tok;
        while (tok = next.call(exports.lexer)) {
            if (tok.type === 'space') {
                continue;
            }
            if (tok.type === 'commentLine' || tok.type === 'commentFull') {
                comments === null || comments === void 0 ? void 0 : comments.push({
                    _location: { start: tok.offset, end: tok.offset + tok.text.length },
                    comment: tok.text,
                });
                continue;
            }
            break;
        }
        if (trackingLoc && tok) {
            const start = tok.offset;
            const loc = {
                start,
                end: start + tok.text.length,
            };
            tok._location = loc;
        }
        return tok;
    })(exports.lexer.next);
    exports.lexerAny = exports.lexer;
    let comments = null;
    function trackingComments(act) {
        if (comments) {
            throw new Error('WAT ? Recursive comments tracking 🤔🤨 ?');
        }
        try {
            comments = [];
            const ast = act();
            return { comments, ast };
        }
        finally {
            comments = null;
        }
    }
    exports.trackingComments = trackingComments;
    let trackingLoc = false;
    function tracking(act) {
        if (trackingLoc) {
            return act();
        }
        try {
            trackingLoc = true;
            return act();
        }
        finally {
            trackingLoc = false;
        }
    }
    exports.tracking = tracking;
    function track(xs, ret) {
        if (!trackingLoc || !ret || typeof ret !== 'object') {
            return ret;
        }
        const start = seek(xs, true);
        const end = seek(xs, false);
        if (!start || !end) {
            return ret;
        }
        if (start === end) {
            ret._location = start;
        }
        else {
            const loc = {
                start: start.start,
                end: end.end,
            };
            ret._location = loc;
        }
        return ret;
    }
    exports.track = track;
    const literal = Symbol('_literal');
    function box(xs, value) {
        if (!trackingLoc) {
            return value;
        }
        return track(xs, { [literal]: value });
    }
    exports.box = box;
    function unbox(value) {
        var _a;
        if (!trackingLoc) {
            return value;
        }
        if (typeof value === 'object') {
            return (_a = value === null || value === void 0 ? void 0 : value[literal]) !== null && _a !== void 0 ? _a : value;
        }
        return value;
    }
    exports.unbox = unbox;
    function seek(xs, start) {
        if (!xs) {
            return null;
        }
        if (Array.isArray(xs)) {
            const diff = start ? 1 : -1;
            for (let i = start ? 0 : xs.length - 1; i >= 0 && i < xs.length; i += diff) {
                const v = seek(xs[i], start);
                if (v) {
                    return v;
                }
            }
            return null;
        }
        if (typeof xs !== 'object') {
            return null;
        }
        return xs._location;
    }


    /***/ }),
    /* 2 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AstDefaultMapper = exports.arrayNilMap = exports.assignChanged = exports.astMapper = void 0;
    const utils_1 = __webpack_require__(6);
    /**
     * Builds an AST modifier based on the default implementation, merged with the one you provide.
     *
     * Example of a modifier that renames all reference to columns 'foo' to 'bar'
     * ```ts
     *  const mapper = astMapper(b => ({
     *       ref: a => assignChanged(a, {
     *           name: a.name === 'foo'
     *               ? 'bar'
     *               : a.name
     *       })
     *   }));
     *
     * const modified = mapper.statement(myStatementToModify);
     * ```
     */
    function astMapper(modifierBuilder) {
        const instance = new AstDefaultMapper();
        instance.wrapped = modifierBuilder(instance);
        return instance;
    }
    exports.astMapper = astMapper;
    /**
     * An helper function that returns a copy of an object with modified properties
     * (similar to Object.assign()), but ONLY if thos properties have changed.
     * Will return the original object if not.
     */
    function assignChanged(orig, assign) {
        if (!orig) {
            return orig;
        }
        let changed = false;
        for (const k of Object.keys(assign)) {
            if (orig[k] !== assign[k]) {
                changed = true;
                break;
            }
        }
        if (!changed) {
            return orig;
        }
        return utils_1.trimNullish({
            ...orig,
            ...assign,
        }, 0);
    }
    exports.assignChanged = assignChanged;
    /**
     * An helper function that returns a map of an array, but:
     * - It will return the original array if it is null-ish
     * - It will remove all null-ish entries
     * - It will return the original array if nothing has changed
     */
    function arrayNilMap(collection, mapper) {
        if (!(collection === null || collection === void 0 ? void 0 : collection.length)) {
            return collection;
        }
        let changed = false;
        let ret = collection;
        for (let i = 0; i < collection.length; i++) {
            const orig = collection[i];
            const val = mapper(orig);
            if (!val || val !== orig) {
                changed = true;
                ret = collection.slice(0, i);
            }
            if (!val) {
                continue;
            }
            if (changed) {
                ret.push(val);
            }
        }
        return ret;
    }
    exports.arrayNilMap = arrayNilMap;
    function withAccepts(val) {
        switch (val === null || val === void 0 ? void 0 : val.type) {
            case 'select':
            case 'delete':
            case 'insert':
            case 'update':
            case 'union':
            case 'union all':
            case 'with':
                return true;
            default:
                return false;
        }
    }
    /**
     * Can be used to modify an AST.
     *
     * You will have to override functions that you're interested in to use this class.
     *
     * Example: Will remove all references in
     */
    class AstDefaultMapper {
        super() {
            return new SkipModifier(this);
        }
        statement(val) {
            switch (val.type) {
                case 'alter table':
                    return this.alterTable(val);
                case 'commit':
                case 'start transaction':
                case 'rollback':
                    return this.transaction(val);
                case 'create index':
                    return this.createIndex(val);
                case 'create table':
                    return this.createTable(val);
                case 'truncate table':
                    return this.truncateTable(val);
                case 'delete':
                    return this.delete(val);
                case 'insert':
                    return this.insert(val);
                case 'with':
                    return this.with(val);
                case 'with recursive':
                    return this.withRecursive(val);
                case 'select':
                    return this.selection(val);
                case 'update':
                    return this.update(val);
                case 'create extension':
                    return this.createExtension(val);
                case 'tablespace':
                    return this.tablespace(val);
                case 'set':
                    return this.setGlobal(val);
                case 'set timezone':
                    return this.setTimezone(val);
                case 'create sequence':
                    return this.createSequence(val);
                case 'alter sequence':
                    return this.alterSequence(val);
                case 'begin':
                    return this.begin(val);
                case 'drop index':
                    return this.dropIndex(val);
                case 'drop sequence':
                    return this.dropSequence(val);
                case 'drop table':
                    return this.dropTable(val);
                case 'create enum':
                    return this.createEnum(val);
                case 'union':
                case 'union all':
                    return this.union(val);
                case 'show':
                    return this.show(val);
                case 'prepare':
                    return this.prepare(val);
                case 'create view':
                    return this.createView(val);
                case 'create materialized view':
                    return this.createMaterializedView(val);
                case 'create schema':
                    return this.createSchema(val);
                case 'raise':
                    return this.raise(val);
                case 'comment':
                    return this.comment(val);
                case 'do':
                    return this.do(val);
                case 'create function':
                    return this.createFunction(val);
                case 'values':
                    return this.values(val);
                default:
                    throw utils_1.NotSupported.never(val);
            }
        }
        comment(val) {
            // not really supported :/
            return val;
        }
        createView(val) {
            const query = this.select(val.query);
            if (!query) {
                return null;
            }
            const ref = this.tableRef(val.name);
            if (!ref) {
                return null;
            }
            return assignChanged(val, {
                query,
                name: ref,
            });
        }
        createMaterializedView(val) {
            const query = this.select(val.query);
            if (!query) {
                return null;
            }
            const ref = this.tableRef(val.name);
            if (!ref) {
                return null;
            }
            return assignChanged(val, {
                query,
                name: ref,
            });
        }
        do(val) {
            return val;
        }
        createFunction(val) {
            // process arguments
            const args = arrayNilMap(val.arguments, a => {
                const type = this.dataType(a.type);
                return assignChanged(a, { type });
            });
            // process return type
            let returns;
            if (val.returns) {
                switch (val.returns.kind) {
                    case 'table':
                        returns = assignChanged(val.returns, {
                            columns: arrayNilMap(val.returns.columns, v => {
                                const type = this.dataType(v.type);
                                return type && assignChanged(v, { type });
                            })
                        });
                        break;
                    case undefined:
                    case null:
                    case 'array':
                        returns = this.dataType(val.returns);
                        break;
                    default:
                        throw utils_1.NotSupported.never(val.returns);
                }
            }
            return assignChanged(val, {
                returns,
                arguments: args,
            });
        }
        show(val) {
            return val;
        }
        createEnum(val) {
            return val;
        }
        dropTable(val) {
            return val;
        }
        dropIndex(val) {
            return val;
        }
        dropSequence(val) {
            return val;
        }
        alterSequence(seq) {
            if (seq.change.type === 'set options') {
                if (seq.change.as) {
                    this.dataType(seq.change.as);
                }
            }
            return seq;
        }
        begin(begin) {
            return begin;
        }
        createSequence(seq) {
            if (seq.options.as) {
                this.dataType(seq.options.as);
            }
            return seq;
        }
        tablespace(val) {
            return val;
        }
        setGlobal(val) {
            return val;
        }
        setTimezone(val) {
            return val;
        }
        update(val) {
            if (!val) {
                return val;
            }
            const table = this.tableRef(val.table);
            if (!table) {
                return null; // nothing to update
            }
            const where = val.where && this.expr(val.where);
            const sets = arrayNilMap(val.sets, x => this.set(x));
            if (!(sets === null || sets === void 0 ? void 0 : sets.length)) {
                return null; // nothing to update
            }
            const returning = arrayNilMap(val.returning, c => this.selectionColumn(c));
            return assignChanged(val, {
                table,
                where,
                sets,
                returning,
            });
        }
        insert(val) {
            var _a, _b;
            const into = this.tableRef(val.into);
            if (!into) {
                return null; // nowhere to insert into
            }
            const select = val.insert && this.select(val.insert);
            if (!select) {
                // nothing to insert
                return null;
            }
            const returning = arrayNilMap(val.returning, c => this.selectionColumn(c));
            const onConflictOn = arrayNilMap((_a = val.onConflict) === null || _a === void 0 ? void 0 : _a.on, e => this.expr(e));
            let ocdo = (_b = val.onConflict) === null || _b === void 0 ? void 0 : _b.do;
            if (ocdo && ocdo !== 'do nothing') {
                const sets = arrayNilMap(ocdo.sets, x => this.set(x));
                if (!(sets === null || sets === void 0 ? void 0 : sets.length)) {
                    ocdo = 'do nothing';
                }
                else if (ocdo.sets !== sets) {
                    ocdo = { sets };
                }
            }
            return assignChanged(val, {
                into,
                insert: select,
                returning,
                onConflict: !ocdo ? val.onConflict : assignChanged(val.onConflict, {
                    do: ocdo,
                    on: onConflictOn,
                }),
            });
        }
        raise(val) {
            return assignChanged(val, {
                formatExprs: val.formatExprs && arrayNilMap(val.formatExprs, x => this.expr(x)),
                using: val.using && arrayNilMap(val.using, u => {
                    return assignChanged(u, {
                        value: this.expr(u.value),
                    });
                }),
            });
        }
        delete(val) {
            const from = this.tableRef(val.from);
            if (!from) {
                return null; // nothing to delete
            }
            const where = val.where && this.expr(val.where);
            const returning = arrayNilMap(val.returning, c => this.selectionColumn(c));
            return assignChanged(val, {
                where,
                returning,
                from,
            });
        }
        createSchema(val) {
            return val;
        }
        createTable(val) {
            const columns = arrayNilMap(val.columns, col => {
                switch (col.kind) {
                    case 'column':
                        return this.createColumn(col);
                    case 'like table':
                        return this.likeTable(col);
                    default:
                        throw utils_1.NotSupported.never(col);
                }
            });
            if (!(columns === null || columns === void 0 ? void 0 : columns.length)) {
                return null; // no column to create
            }
            return assignChanged(val, {
                columns,
            });
        }
        likeTable(col) {
            const like = this.tableRef(col.like);
            if (!like) {
                return null;
            }
            return assignChanged(col, { like });
        }
        truncateTable(val) {
            return val;
        }
        constraint(c) {
            switch (c.type) {
                case 'not null':
                case 'null':
                case 'primary key':
                case 'unique':
                case 'add generated':
                    return c;
                case 'default': {
                    const def = this.expr(c.default);
                    if (!def) {
                        return null;
                    }
                    return assignChanged(c, {
                        default: def,
                    });
                }
                case 'check': {
                    const def = this.expr(c.expr);
                    if (!def) {
                        return null;
                    }
                    return assignChanged(c, {
                        expr: def,
                    });
                }
                default:
                    throw utils_1.NotSupported.never(c);
            }
        }
        set(st) {
            const value = st.value === 'default'
                ? st.value
                : this.expr(st.value);
            if (!value) {
                return null;
            }
            return assignChanged(st, {
                value,
            });
        }
        // =========================================
        // ================ STUFF ==================
        // =========================================
        /** Called when a data type definition is encountered */
        dataType(dataType) {
            return dataType;
        }
        /** Called when an alias of a table is created */
        tableRef(st) {
            return st;
        }
        transaction(val) {
            return val;
        }
        createExtension(val) {
            return val;
        }
        createIndex(val) {
            const expressions = arrayNilMap(val.expressions, e => {
                const expression = this.expr(e.expression);
                if (expression === e.expression) {
                    return e;
                }
                if (!expression) {
                    return null; // no more index expression
                }
                return {
                    ...e,
                    expression,
                };
            });
            if (!(expressions === null || expressions === void 0 ? void 0 : expressions.length)) {
                return null; // no columns to create index on
            }
            return assignChanged(val, {
                expressions,
            });
        }
        prepare(st) {
            const statement = this.statement(st.statement);
            if (!statement) {
                return null;
            }
            return assignChanged(st, {
                args: arrayNilMap(st.args, a => this.dataType(a)),
                statement,
            });
        }
        // =========================================
        // ============== ALTER TABLE ==============
        // =========================================
        alterTable(st) {
            const table = this.tableRef(st.table);
            if (!table) {
                return null; // no table
            }
            let change;
            switch (st.change.type) {
                case 'add column': {
                    change = this.addColumn(st.change, st.table);
                    break;
                }
                case 'add constraint': {
                    change = this.addConstraint(st.change, st.table);
                    break;
                }
                case 'alter column': {
                    change = this.alterColumn(st.change, st.table);
                    break;
                }
                case 'rename': {
                    change = this.renameTable(st.change, st.table);
                    break;
                }
                case 'rename column': {
                    change = this.renameColumn(st.change, st.table);
                    break;
                }
                case 'rename constraint': {
                    change = this.renameConstraint(st.change, st.table);
                    break;
                }
                case 'drop column': {
                    change = this.dropColumn(st.change, st.table);
                    break;
                }
                case 'owner': {
                    change = this.setTableOwner(st.change, st.table);
                    break;
                }
                default:
                    throw utils_1.NotSupported.never(st.change);
            }
            if (!change) {
                return null; // no change left
            }
            return assignChanged(st, {
                table,
                change,
            });
        }
        dropColumn(change, table) {
            return change;
        }
        setTableOwner(change, table) {
            return change;
        }
        renameConstraint(change, table) {
            return change;
        }
        renameColumn(change, table) {
            return change;
        }
        renameTable(change, table) {
            return change;
        }
        alterColumn(change, inTable) {
            let alter;
            switch (change.alter.type) {
                case 'set default':
                    alter = this.setColumnDefault(change.alter, inTable, change.column);
                    break;
                case 'set type':
                    alter = this.setColumnType(change.alter, inTable, change.column);
                    break;
                case 'drop default':
                case 'set not null':
                case 'drop not null':
                    alter = this.alterColumnSimple(change.alter, inTable, change.column);
                    break;
                case 'add generated':
                    alter = this.alterColumnAddGenerated(change.alter, inTable, change.column);
                    break;
                default:
                    throw utils_1.NotSupported.never(change.alter);
            }
            if (!alter) {
                return null; // no more alter
            }
            return assignChanged(change, {
                alter,
            });
        }
        setColumnType(alter, inTable, inColumn) {
            const dataType = this.dataType(alter.dataType);
            return assignChanged(alter, {
                dataType,
            });
        }
        alterColumnAddGenerated(alter, inTable, inColumn) {
            return alter;
        }
        alterColumnSimple(alter, inTable, inColumn) {
            return alter;
        }
        setColumnDefault(alter, inTable, inColumn) {
            const def = this.expr(alter.default);
            if (!def) {
                return null; // no more default to set
            }
            return assignChanged(alter, {
                default: def,
            });
        }
        addConstraint(change, inTable) {
            return change;
        }
        addColumn(change, inTable) {
            const column = this.createColumn(change.column);
            if (!column) {
                return null; // no more column to add
            }
            return assignChanged(change, {
                column,
            });
        }
        createColumn(col) {
            var _a;
            // to be overriden
            const dataType = this.dataType(col.dataType);
            if (!dataType) {
                return null; // no data type => remove column
            }
            const constraints = (_a = arrayNilMap(col.constraints, m => this.constraint(m))) !== null && _a !== void 0 ? _a : undefined;
            return assignChanged(col, {
                dataType,
                constraints,
            });
        }
        // =========================================
        // ============== SELECTIONS ==============
        // =========================================
        select(val) {
            switch (val.type) {
                case 'select':
                    return this.selection(val);
                case 'union':
                case 'union all':
                    return this.union(val);
                case 'with':
                    return this.with(val);
                case 'values':
                    return this.values(val);
                case 'with recursive':
                    return this.withRecursive(val);
                default:
                    throw utils_1.NotSupported.never(val);
            }
        }
        selection(val) {
            var _a, _b;
            const from = arrayNilMap(val.from, c => this.from(c));
            const columns = arrayNilMap(val.columns, c => this.selectionColumn(c));
            const where = val.where && this.expr(val.where);
            const groupBy = arrayNilMap(val.groupBy, c => this.expr(c));
            const orderBy = this.orderBy(val.orderBy);
            const limit = assignChanged(val.limit, {
                limit: this.expr((_a = val.limit) === null || _a === void 0 ? void 0 : _a.limit),
                offset: this.expr((_b = val.limit) === null || _b === void 0 ? void 0 : _b.offset),
            });
            return assignChanged(val, {
                from,
                columns,
                where,
                groupBy,
                orderBy,
                limit,
            });
        }
        orderBy(orderBy) {
            return arrayNilMap(orderBy, c => {
                const by = this.expr(c.by);
                if (!by) {
                    return null;
                }
                if (by === c.by) {
                    return c;
                }
                return {
                    ...c,
                    by,
                };
            });
        }
        union(val) {
            const left = this.select(val.left);
            const right = this.select(val.right);
            if (!left || !right) {
                return left !== null && left !== void 0 ? left : right;
            }
            return assignChanged(val, {
                left,
                right
            });
        }
        with(val) {
            const bind = arrayNilMap(val.bind, s => {
                const statement = this.statement(s.statement);
                return withAccepts(statement)
                    ? assignChanged(s, { statement })
                    : null;
            });
            // no bindngs
            if (!bind) {
                return null;
            }
            const _in = this.statement(val.in);
            if (!withAccepts(_in)) {
                return null;
            }
            return assignChanged(val, {
                bind,
                in: _in,
            });
        }
        withRecursive(val) {
            const statement = this.union(val.bind);
            if (!statement) {
                return null;
            }
            // 'with recursive' only accepts unions
            if (statement.type !== 'union' && statement.type !== 'union all') {
                return null;
            }
            const _in = this.statement(val.in);
            if (!withAccepts(_in)) {
                return null;
            }
            return assignChanged(val, {
                bind: statement,
                in: _in,
            });
        }
        from(from) {
            switch (from.type) {
                case 'table':
                    return this.fromTable(from);
                case 'statement':
                    return this.fromStatement(from);
                case 'call':
                    return this.fromCall(from);
                default:
                    throw utils_1.NotSupported.never(from);
            }
        }
        fromCall(from) {
            const call = this.call(from);
            if (!call || call.type !== 'call') {
                return null;
            }
            return assignChanged(from, call);
        }
        fromStatement(from) {
            const statement = this.select(from.statement);
            if (!statement) {
                return null; // nothing to select from
            }
            const join = from.join && this.join(from.join);
            return assignChanged(from, {
                statement,
                join,
            });
        }
        values(from) {
            const values = arrayNilMap(from.values, x => arrayNilMap(x, y => this.expr(y)));
            if (!(values === null || values === void 0 ? void 0 : values.length)) {
                return null; // nothing to select from
            }
            return assignChanged(from, {
                values,
            });
        }
        join(join) {
            const on = join.on && this.expr(join.on);
            if (!on && !join.using) {
                return null;
            }
            return assignChanged(join, {
                on,
            });
        }
        fromTable(from) {
            const nfrom = this.tableRef(from.name);
            if (!nfrom) {
                return null; // nothing to select from
            }
            const join = from.join && this.join(from.join);
            return assignChanged(from, {
                name: nfrom,
                join,
            });
        }
        selectionColumn(val) {
            const expr = this.expr(val.expr);
            if (!expr) {
                return null; // not selected anymore
            }
            return assignChanged(val, {
                expr,
            });
        }
        // =========================================
        // ============== EXPRESSIONS ==============
        // =========================================
        expr(val) {
            if (!val) {
                return val;
            }
            switch (val.type) {
                case 'binary':
                    return this.binary(val);
                case 'unary':
                    return this.unary(val);
                case 'ref':
                    return this.ref(val);
                case 'string':
                case 'numeric':
                case 'integer':
                case 'boolean':
                case 'constant':
                case 'null':
                    return this.constant(val);
                case 'list':
                case 'array':
                    return this.array(val);
                case 'array select':
                    return this.arraySelect(val);
                case 'call':
                    return this.call(val);
                case 'cast':
                    return this.cast(val);
                case 'case':
                    return this.case(val);
                case 'member':
                    return this.member(val);
                case 'arrayIndex':
                    return this.arrayIndex(val);
                case 'ternary':
                    return this.ternary(val);
                case 'select':
                case 'union':
                case 'union all':
                case 'with':
                case 'with recursive':
                    return this.select(val);
                case 'keyword':
                    return this.valueKeyword(val);
                case 'parameter':
                    return this.parameter(val);
                case 'extract':
                    return this.extract(val);
                case 'overlay':
                    return this.callOverlay(val);
                case 'substring':
                    return this.callSubstring(val);
                case 'values':
                    return this.values(val);
                case 'default':
                    return this.default(val);
                default:
                    throw utils_1.NotSupported.never(val);
            }
        }
        arraySelect(val) {
            const select = this.select(val.select);
            if (!select) {
                return null;
            }
            return assignChanged(val, { select });
        }
        extract(st) {
            const from = this.expr(st.from);
            if (!from) {
                return null;
            }
            return assignChanged(st, { from });
        }
        valueKeyword(val) {
            return val;
        }
        ternary(val) {
            const value = this.expr(val.value);
            const lo = this.expr(val.lo);
            const hi = this.expr(val.hi);
            if (!value || !lo || !hi) {
                return null; // missing a branch
            }
            return assignChanged(val, {
                value,
                lo,
                hi,
            });
        }
        parameter(st) {
            return st;
        }
        arrayIndex(val) {
            const array = this.expr(val.array);
            const index = this.expr(val.index);
            if (!array || !index) {
                return null;
            }
            return assignChanged(val, {
                array,
                index,
            });
        }
        member(val) {
            const operand = this.expr(val.operand);
            if (!operand) {
                return null;
            }
            return assignChanged(val, {
                operand,
            });
        }
        case(val) {
            const value = val.value && this.expr(val.value);
            const whens = arrayNilMap(val.whens, w => {
                const when = this.expr(w.when);
                const value = this.expr(w.value);
                if (!when || !value) {
                    return null;
                }
                return assignChanged(w, {
                    value,
                    when,
                });
            });
            if (!(whens === null || whens === void 0 ? void 0 : whens.length)) {
                return null; // no case
            }
            const els = val.else && this.expr(val.else);
            return assignChanged(val, {
                value,
                whens,
                else: els,
            });
        }
        cast(val) {
            const operand = this.expr(val.operand);
            if (!operand) {
                return null;
            }
            return assignChanged(val, {
                operand,
            });
        }
        call(val) {
            const args = arrayNilMap(val.args, a => this.expr(a));
            if (!args) {
                return null;
            }
            const orderBy = this.orderBy(val.orderBy);
            const filter = this.expr(val.filter);
            return assignChanged(val, {
                args,
                orderBy,
                filter,
            });
        }
        callSubstring(val) {
            return assignChanged(val, {
                value: this.expr(val.value),
                from: this.expr(val.from),
                for: this.expr(val.for),
            });
        }
        callOverlay(val) {
            return assignChanged(val, {
                value: this.expr(val.value),
                placing: this.expr(val.placing),
                from: this.expr(val.from),
                for: this.expr(val.for),
            });
        }
        array(val) {
            const expressions = arrayNilMap(val.expressions, a => this.expr(a));
            if (!expressions) {
                return null;
            }
            return assignChanged(val, {
                expressions,
            });
        }
        constant(value) {
            return value;
        }
        default(value) {
            return value;
        }
        /** Called when a reference is used */
        ref(val) {
            return val;
        }
        unary(val) {
            const operand = this.expr(val.operand);
            if (!operand) {
                return null;
            }
            return assignChanged(val, {
                operand,
            });
        }
        binary(val) {
            const left = this.expr(val.left);
            const right = this.expr(val.right);
            if (!left || !right) {
                return null;
            }
            return assignChanged(val, {
                left,
                right,
            });
        }
    }
    exports.AstDefaultMapper = AstDefaultMapper;
    // ====== auto implement the replace mechanism
    const proto = AstDefaultMapper.prototype;
    for (const k of Object.getOwnPropertyNames(proto)) {
        const orig = proto[k];
        if (k === 'constructor' || k === 'super' || typeof orig !== 'function') {
            continue;
        }
        Object.defineProperty(proto, k, {
            configurable: false,
            get() {
                return function (...args) {
                    var _a;
                    const impl = (_a = this.wrapped) === null || _a === void 0 ? void 0 : _a[k];
                    if (!impl) {
                        return orig.apply(this, args);
                    }
                    return impl.apply(this.wrapped, args);
                };
            }
        });
    }
    // ====== auto implement the skip mechanism
    class SkipModifier extends AstDefaultMapper {
        constructor(parent) {
            super();
            this.parent = parent;
        }
    }
    for (const k of Object.getOwnPropertyNames(proto)) {
        const orig = proto[k];
        if (k === 'constructor' || k === 'super' || typeof orig !== 'function') {
            continue;
        }
        Object.defineProperty(SkipModifier.prototype, k, {
            configurable: false,
            get() {
                return function (...args) {
                    return orig.apply(this.parent.wrapped, args);
                };
            }
        });
    }


    /***/ }),
    /* 3 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sqlKeywords = void 0;
    // https://www.postgresql.org/docs/current/sql-keywords-appendix.html
    // $('table.table').children('tbody').children().toArray().filter(x => { const txt = $($(x).children()[1]).text(); return txt.includes('reserved') && !txt.includes('non-reserved')}).map(x => $($(x).children()[0]).text())
    exports.sqlKeywords = [
        "ALL", "ANALYSE", "ANALYZE", "AND", "ANY", "ARRAY", "AS", "ASC", "ASYMMETRIC", "AUTHORIZATION", "BINARY", "BOTH", "CASE", "CAST", "CHECK", "COLLATE", "COLLATION", "COLUMN", "CONCURRENTLY", "CONSTRAINT", "CREATE", "CROSS", "CURRENT_CATALOG", "CURRENT_DATE", "CURRENT_ROLE", "CURRENT_SCHEMA", "CURRENT_TIME", "CURRENT_TIMESTAMP", "CURRENT_USER", "DEFAULT", "DEFERRABLE", "DESC", "DISTINCT", "DO", "ELSE", "END", "EXCEPT", "FALSE", "FETCH", "FOR", "FOREIGN", "FREEZE", "FROM", "FULL", "GRANT", "GROUP", "HAVING", "ILIKE", "IN", "INITIALLY", "INNER", "INTERSECT", "INTO", "IS", "ISNULL", "JOIN", "LATERAL", "LEADING", "LEFT", "LIKE", "LIMIT", "LOCALTIME", "LOCALTIMESTAMP", "NATURAL", "NOT", "NOTNULL", "NULL", "OFFSET", "ON", "ONLY", "OR", "ORDER", "OUTER", "OVERLAPS", "PLACING", "PRIMARY", "REFERENCES", "RETURNING", "RIGHT", "SELECT", "SESSION_USER", "SIMILAR", "SOME", "SYMMETRIC", "TABLE", "TABLESAMPLE", "THEN", "TO", "TRAILING", "TRUE", "UNION", "UNIQUE", "USER", "USING", "VARIADIC", "VERBOSE", "WHEN", "WHERE", "WINDOW", "WITH"
        // added manually
        ,
        "PRECISION"
    ];


    /***/ }),
    /* 4 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.intervalToString = exports.normalizeInterval = exports.buildInterval = void 0;
    const types = [
        ['years', 12],
        ['months', 30],
        ['days', 24],
        ['hours', 60],
        ['minutes', 60],
        ['seconds', 1000],
        ['milliseconds', 0],
    ];
    function* unwrap(k) {
        if (typeof k[1] === 'number') {
            yield k;
        }
        else {
            for (const v of k) {
                yield* unwrap(v);
            }
        }
    }
    function buildInterval(orig, vals) {
        var _a;
        const ret = {};
        if (vals === 'invalid') {
            throw new Error(`invalid input syntax for type interval: "${orig}"`);
        }
        for (const [k, v] of unwrap(vals)) {
            ret[k] = ((_a = ret[k]) !== null && _a !== void 0 ? _a : 0) + v;
        }
        return ret;
    }
    exports.buildInterval = buildInterval;
    /** Returns a normalized copy of the given interval */
    function normalizeInterval(value) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const ret = { ...value };
        // trim non-integers
        for (let i = 0; i < types.length; i++) {
            const [k, mul] = types[i];
            const v = (_a = ret[k]) !== null && _a !== void 0 ? _a : 0;
            const int = v >= 0
                ? Math.floor(v)
                : Math.ceil(v);
            if (!v || int === v) {
                continue;
            }
            const nk = (_b = types[i + 1]) === null || _b === void 0 ? void 0 : _b[0];
            if (nk) {
                ret[nk] = ((_c = ret[nk]) !== null && _c !== void 0 ? _c : 0) + mul * (v - int);
            }
            ret[k] = int;
        }
        if (ret.months || ret.years) {
            const m = ((_d = ret.months) !== null && _d !== void 0 ? _d : 0) + ((_e = ret.years) !== null && _e !== void 0 ? _e : 0) * 12;
            ret.months = m % 12;
            ret.years = (m - ret.months) / 12;
        }
        // normalize time
        let t = ((_f = ret.hours) !== null && _f !== void 0 ? _f : 0) * 3600
            + ((_g = ret.minutes) !== null && _g !== void 0 ? _g : 0) * 60
            + ((_h = ret.seconds) !== null && _h !== void 0 ? _h : 0)
            + ((_j = ret.milliseconds) !== null && _j !== void 0 ? _j : 0) / 1000;
        let sign = 1;
        if (t < 0) {
            sign = -1;
            t = -t;
        }
        if (t >= 3600) {
            ret.hours = sign * Math.floor(t / 3600);
            t -= sign * ret.hours * 3600;
        }
        else {
            delete ret.hours;
        }
        if (t >= 60) {
            ret.minutes = sign * Math.floor(t / 60);
            t -= sign * ret.minutes * 60;
        }
        else {
            delete ret.minutes;
        }
        if (t > 0) {
            ret.seconds = sign * Math.floor(t);
            t -= sign * ret.seconds;
        }
        else {
            delete ret.seconds;
        }
        if (t > 0) {
            ret.milliseconds = sign * Math.round(t * 1000);
        }
        else {
            delete ret.milliseconds;
        }
        // trim zeros.
        for (const [k] of types) {
            if (!ret[k]) {
                delete ret[k];
            }
        }
        return ret;
    }
    exports.normalizeInterval = normalizeInterval;
    /** Interval value to postgres string representation  */
    function intervalToString(value) {
        var _a, _b, _c;
        value = normalizeInterval(value);
        const ret = [];
        if (value.years) {
            ret.push(value.years === 1 ? '1 year' : value.years + ' years');
        }
        if (value.months) {
            ret.push(value.months === 1 ? '1 month' : value.months + ' months');
        }
        if (value.days) {
            ret.push(value.days === 1 ? '1 day' : value.days + ' days');
        }
        if (value.hours || value.minutes || value.seconds || value.milliseconds) {
            let time = `${num((_a = value.hours) !== null && _a !== void 0 ? _a : 0)}:${num((_b = value.minutes) !== null && _b !== void 0 ? _b : 0)}:${num((_c = value.seconds) !== null && _c !== void 0 ? _c : 0)}`;
            if (value.milliseconds) {
                time = time + (value.milliseconds / 1000).toString().substr(1);
            }
            if (neg(value.hours) || neg(value.minutes) || neg(value.seconds) || neg(value.milliseconds)) {
                time = '-' + time;
            }
            ret.push(time);
        }
        return ret.join(' ');
    }
    exports.intervalToString = intervalToString;
    function num(v) {
        v = Math.abs(v);
        return v < 10 ? '0' + v : v.toString();
    }
    function neg(v) {
        return v && v < 0;
    }


    /***/ }),
    /* 5 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.astVisitor = void 0;
    const ast_mapper_1 = __webpack_require__(2);
    class Visitor {
        super() {
            return new SkipVisitor(this);
        }
    }
    // =============== auto implement the mapper
    const mapperProto = ast_mapper_1.AstDefaultMapper.prototype;
    for (const k of Object.getOwnPropertyNames(mapperProto)) {
        const orig = mapperProto[k];
        if (k === 'constructor' || k === 'super' || typeof orig !== 'function') {
            continue;
        }
        Object.defineProperty(Visitor.prototype, k, {
            configurable: false,
            get() {
                return function (...args) {
                    const impl = this.visitor[k];
                    if (!impl) {
                        // just ignore & forward call to mapper
                        return orig.apply(this, args);
                    }
                    // return first argument
                    // ...which means "I dont wana change anything"
                    //    in the ast-modifier language.
                    impl.apply(this.visitor, args);
                    return args[0];
                };
            }
        });
    }
    // ====== auto implement the skip mechanism
    class SkipVisitor {
        constructor(parent) {
            this.parent = parent;
        }
    }
    for (const k of Object.getOwnPropertyNames(mapperProto)) {
        const orig = mapperProto[k];
        if (k === 'constructor' || k === 'super' || typeof orig !== 'function') {
            continue;
        }
        Object.defineProperty(SkipVisitor.prototype, k, {
            configurable: false,
            get() {
                return function (...args) {
                    return orig.apply(this.parent, args);
                };
            }
        });
    }
    /**
     * Builds an AST visitor based on the default implementation, merged with the one you provide.
     *
     * Example of visitor which counts references to a column 'foo':
     *
     * ```ts
     * let cnt = 0;
     * const visitor = astVisitor(v => ({
     *      ref: r => {
     *          if (r.name === 'foo') {
     *              cnt++;
     *          }
     *          v.super().ref(r);
     *      }
     *  }));
     *
     * visitor.statement(myStatementToCount);
     * console.log(`${cnt} references to foo !`);
     * ```
     */
    function astVisitor(visitorBuilder) {
        return ast_mapper_1.astMapper(m => {
            const ret = new Visitor();
            ret.mapper = m;
            ret.visitor = visitorBuilder(ret);
            return ret;
        });
    }
    exports.astVisitor = astVisitor;


    /***/ }),
    /* 6 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.trimNullish = exports.NotSupported = void 0;
    class NotSupported extends Error {
        constructor(what) {
            super('Not supported' + (what ? ': ' + what : ''));
        }
        static never(value, msg) {
            return new NotSupported(`${msg !== null && msg !== void 0 ? msg : ''} ${JSON.stringify(value)}`);
        }
    }
    exports.NotSupported = NotSupported;
    function trimNullish(value, depth = 5) {
        if (depth < 0)
            return value;
        if (value instanceof Array) {
            value.forEach(x => trimNullish(x, depth - 1));
        }
        if (typeof value !== 'object' || value instanceof Date)
            return value;
        if (!value) {
            return value;
        }
        for (const k of Object.keys(value)) {
            const val = value[k];
            if (val === undefined || val === null)
                delete value[k];
            else
                trimNullish(val, depth - 1);
        }
        return value;
    }
    exports.trimNullish = trimNullish;


    /***/ }),
    /* 7 */
    /***/ (function(module, exports, __webpack_require__) {

    var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (this && this.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var parser_1 = __webpack_require__(8);
    Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return parser_1.parse; } });
    Object.defineProperty(exports, "parseFirst", { enumerable: true, get: function () { return parser_1.parseFirst; } });
    Object.defineProperty(exports, "parseArrayLiteral", { enumerable: true, get: function () { return parser_1.parseArrayLiteral; } });
    Object.defineProperty(exports, "parseGeometricLiteral", { enumerable: true, get: function () { return parser_1.parseGeometricLiteral; } });
    Object.defineProperty(exports, "parseIntervalLiteral", { enumerable: true, get: function () { return parser_1.parseIntervalLiteral; } });
    Object.defineProperty(exports, "parseWithComments", { enumerable: true, get: function () { return parser_1.parseWithComments; } });
    var ast_visitor_1 = __webpack_require__(5);
    Object.defineProperty(exports, "astVisitor", { enumerable: true, get: function () { return ast_visitor_1.astVisitor; } });
    var ast_mapper_1 = __webpack_require__(2);
    Object.defineProperty(exports, "arrayNilMap", { enumerable: true, get: function () { return ast_mapper_1.arrayNilMap; } });
    Object.defineProperty(exports, "assignChanged", { enumerable: true, get: function () { return ast_mapper_1.assignChanged; } });
    Object.defineProperty(exports, "astMapper", { enumerable: true, get: function () { return ast_mapper_1.astMapper; } });
    var to_sql_1 = __webpack_require__(19);
    Object.defineProperty(exports, "toSql", { enumerable: true, get: function () { return to_sql_1.toSql; } });
    __exportStar(__webpack_require__(21), exports);
    var interval_builder_1 = __webpack_require__(4);
    Object.defineProperty(exports, "intervalToString", { enumerable: true, get: function () { return interval_builder_1.intervalToString; } });
    Object.defineProperty(exports, "normalizeInterval", { enumerable: true, get: function () { return interval_builder_1.normalizeInterval; } });


    /***/ }),
    /* 8 */
    /***/ (function(module, exports, __webpack_require__) {

    var __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseGeometricLiteral = exports.parseIntervalLiteral = exports.parseArrayLiteral = exports.parse = exports.parseWithComments = exports.parseFirst = void 0;
    const nearley_1 = __webpack_require__(9);
    const main_ne_1 = __importDefault(__webpack_require__(10));
    const array_ne_1 = __importDefault(__webpack_require__(11));
    const geometric_ne_1 = __importDefault(__webpack_require__(13));
    const interval_ne_1 = __importDefault(__webpack_require__(15));
    const interval_iso_ne_1 = __importDefault(__webpack_require__(17));
    const interval_builder_1 = __webpack_require__(4);
    const lexer_1 = __webpack_require__(1);
    let sqlCompiled;
    let arrayCompiled;
    let geometricCompiled;
    let intervalTextCompiled;
    let intervalIsoCompiled;
    /** Parse the first SQL statement in the given text (discards the rest), and return its AST */
    function parseFirst(sql) {
        const first = parse(sql);
        return first[0];
    }
    exports.parseFirst = parseFirst;
    /** Parse an AST from SQL, and get the comments */
    function parseWithComments(sql, options) {
        return lexer_1.trackingComments(() => parse(sql, options));
    }
    exports.parseWithComments = parseWithComments;
    function parse(sql, optEntry) {
        if (!sqlCompiled) {
            sqlCompiled = nearley_1.Grammar.fromCompiled(main_ne_1.default);
        }
        const entry = typeof optEntry === 'string'
            ? optEntry
            : optEntry === null || optEntry === void 0 ? void 0 : optEntry.entry;
        const opts = typeof optEntry === 'string' ? null : optEntry;
        // parse sql
        const doParse = () => _parse(sql, sqlCompiled, entry);
        let parsed = (opts === null || opts === void 0 ? void 0 : opts.locationTracking) ? lexer_1.tracking(doParse)
            : doParse();
        // always return an array of statements.
        if (!entry && !Array.isArray(parsed)) {
            parsed = [parsed];
        }
        return parsed;
    }
    exports.parse = parse;
    function parseArrayLiteral(sql) {
        if (!arrayCompiled) {
            arrayCompiled = nearley_1.Grammar.fromCompiled(array_ne_1.default);
        }
        return _parse(sql, arrayCompiled);
    }
    exports.parseArrayLiteral = parseArrayLiteral;
    function parseIntervalLiteral(literal) {
        if (literal.startsWith('P')) {
            if (!intervalIsoCompiled) {
                intervalIsoCompiled = nearley_1.Grammar.fromCompiled(interval_iso_ne_1.default);
            }
            return interval_builder_1.buildInterval(literal, _parse(literal, intervalIsoCompiled));
        }
        else {
            if (!intervalTextCompiled) {
                intervalTextCompiled = nearley_1.Grammar.fromCompiled(interval_ne_1.default);
            }
            const low = literal.toLowerCase(); // full text syntax is case insensitive
            return interval_builder_1.buildInterval(literal, _parse(low, intervalTextCompiled));
        }
    }
    exports.parseIntervalLiteral = parseIntervalLiteral;
    function parseGeometricLiteral(sql, type) {
        if (!geometricCompiled) {
            geometricCompiled = nearley_1.Grammar.fromCompiled(geometric_ne_1.default);
        }
        return _parse(sql, geometricCompiled, type);
    }
    exports.parseGeometricLiteral = parseGeometricLiteral;
    function _parse(sql, grammar, entry) {
        try {
            grammar.start = entry !== null && entry !== void 0 ? entry : 'main';
            const parser = new nearley_1.Parser(grammar);
            parser.feed(sql);
            const asts = parser.finish();
            if (!asts.length) {
                throw new Error('Unexpected end of input');
            }
            else if (asts.length !== 1) {
                throw new Error(`💀 Ambiguous SQL syntax: Please file an issue stating the request that has failed at https://github.com/oguimbal/pgsql-ast-parser:

        ${sql}

        `);
            }
            return asts[0];
        }
        catch (e) {
            if (typeof (e === null || e === void 0 ? void 0 : e.message) !== 'string') {
                throw e;
            }
            let msg = e.message;
            // remove all the stack crap of nearley parser
            let begin = null;
            const parts = [];
            const reg = /A (.+) token based on:/g;
            let m;
            while (m = reg.exec(msg)) {
                begin = begin !== null && begin !== void 0 ? begin : msg.substr(0, m.index);
                parts.push(`    - A "${m[1]}" token`);
            }
            if (begin) {
                msg = begin + parts.join('\n') + '\n\n';
            }
            e.message = msg;
            throw e;
        }
    }


    /***/ }),
    /* 9 */
    /***/ (function(module, exports) {

    module.exports = nearley;

    /***/ }),
    /* 10 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    // Generated automatically by nearley, version unknown
    // http://github.com/Hardmath123/nearley
    // Bypasses TS6133. Allow declared but unused functions.
    // @ts-ignore
    function id(d) { return d[0]; }
    const lexer_1 = __webpack_require__(1);
    const lexer_2 = __webpack_require__(1);
    function asName(val) {
        const name = toStr(val);
        return lexer_2.track(val, { name });
    }
    function asLit(val) {
        const value = toStr(val);
        return lexer_2.track(val, { value });
    }
    function unwrap(e) {
        if (Array.isArray(e) && e.length === 1) {
            e = unwrap(e[0]);
        }
        if (Array.isArray(e) && !e.length) {
            return null;
        }
        return lexer_2.unbox(e);
    }
    const get = (i) => (x) => lexer_2.track(x, x[i]);
    const last = (x) => Array.isArray(x) ? lexer_2.track(x[x.length - 1], x[x.length - 1]) : x;
    const value = (x) => x && x.value;
    function flatten(e) {
        if (Array.isArray(e)) {
            const ret = [];
            for (const i of e) {
                ret.push(...flatten(i));
            }
            return ret;
        }
        if (!e) {
            return [];
        }
        return [e];
    }
    function asStr(value) {
        var _a;
        value = lexer_2.unbox(value);
        return (_a = value === null || value === void 0 ? void 0 : value.value) !== null && _a !== void 0 ? _a : value;
    }
    function flattenStr(e) {
        const fl = flatten(lexer_2.unbox(e));
        return fl.filter(x => !!x)
            .map(x => asStr(x))
            .filter(x => typeof x === 'string')
            .map(x => x.trim())
            .filter(x => !!x);
    }
    function toStr(e, join) {
        return flattenStr(e).join(join || '');
    }
    function fromEntries(vals) {
        const ret = {};
        for (const [k, v] of vals) {
            ret[k] = v;
        }
        return ret;
    }
    const kwSensitivity = { sensitivity: 'accent' };
    const eqInsensitive = (a, b) => a.localeCompare(b, undefined, kwSensitivity) === 0;
    const notReservedKw = (kw) => (x, _, rej) => {
        const val = asStr(x[0]);
        if (eqInsensitive(val, kw)) {
            return lexer_2.box(x, kw);
        }
        return rej;
    };
    const kw = notReservedKw;
    const anyKw = (...kw) => {
        const kwSet = new Set(kw);
        return (x, _, rej) => {
            const val = typeof x[0] === 'string' ? x[0] : x[0].value;
            return kwSet.has(val) ? val : rej;
        };
    };
    function setSeqOpts(ret, opts) {
        const defs = new Set();
        const unboxed = opts.map(lexer_2.unbox);
        for (const [k, v] of unboxed) {
            if (defs.has(k)) {
                throw new Error('conflicting or redundant options');
            }
            defs.add(k);
            ret[k] = lexer_2.unbox(v);
        }
    }
    const grammar = {
        Lexer: lexer_1.lexerAny,
        ParserRules: [
            { "name": "lparen", "symbols": [(lexer_1.lexerAny.has("lparen") ? { type: "lparen" } : lparen)] },
            { "name": "rparen", "symbols": [(lexer_1.lexerAny.has("rparen") ? { type: "rparen" } : rparen)] },
            { "name": "number$subexpression$1", "symbols": ["float"] },
            { "name": "number$subexpression$1", "symbols": ["int"] },
            { "name": "number", "symbols": ["number$subexpression$1"], "postprocess": unwrap },
            { "name": "dot", "symbols": [(lexer_1.lexerAny.has("dot") ? { type: "dot" } : dot)], "postprocess": id },
            { "name": "float", "symbols": [(lexer_1.lexerAny.has("float") ? { type: "float" } : float)], "postprocess": x => lexer_2.box(x, parseFloat(unwrap(x))) },
            { "name": "int", "symbols": [(lexer_1.lexerAny.has("int") ? { type: "int" } : int)], "postprocess": x => lexer_2.box(x, parseInt(unwrap(x), 10)) },
            { "name": "comma", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma)], "postprocess": id },
            { "name": "star", "symbols": [(lexer_1.lexerAny.has("star") ? { type: "star" } : star)], "postprocess": x => lexer_2.box(x, x[0].value) },
            { "name": "string$subexpression$1", "symbols": [(lexer_1.lexerAny.has("string") ? { type: "string" } : string)] },
            { "name": "string$subexpression$1", "symbols": [(lexer_1.lexerAny.has("eString") ? { type: "eString" } : eString)] },
            { "name": "string", "symbols": ["string$subexpression$1"], "postprocess": x => lexer_2.box(x, unwrap(x[0]).value) },
            { "name": "ident", "symbols": ["word"], "postprocess": get(0) },
            { "name": "word", "symbols": [(lexer_1.lexerAny.has("kw_primary") ? { type: "kw_primary" } : kw_primary)], "postprocess": x => lexer_2.box(x, 'primary') },
            { "name": "word", "symbols": [(lexer_1.lexerAny.has("kw_unique") ? { type: "kw_unique" } : kw_unique)], "postprocess": x => lexer_2.box(x, 'unique') },
            { "name": "word", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": x => {
                    const val = x[0].value;
                    return lexer_2.box(x, val[0] === '"' ? val.substr(1, val.length - 2) : val);
                } },
            { "name": "collist_paren", "symbols": ["lparen", "collist", "rparen"], "postprocess": get(1) },
            { "name": "collist$ebnf$1", "symbols": [] },
            { "name": "collist$ebnf$1$subexpression$1", "symbols": ["comma", "ident"], "postprocess": last },
            { "name": "collist$ebnf$1", "symbols": ["collist$ebnf$1", "collist$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "collist", "symbols": ["ident", "collist$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "kw_between", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('between') },
            { "name": "kw_conflict", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('conflict') },
            { "name": "kw_nothing", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('nothing') },
            { "name": "kw_begin", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('begin') },
            { "name": "kw_if", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('if') },
            { "name": "kw_exists", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('exists') },
            { "name": "kw_key", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('key') },
            { "name": "kw_index", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('index') },
            { "name": "kw_extension", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('extension') },
            { "name": "kw_schema", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('schema') },
            { "name": "kw_nulls", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('nulls') },
            { "name": "kw_first", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('first') },
            { "name": "kw_last", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('last') },
            { "name": "kw_start", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('start') },
            { "name": "kw_restart", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('restart') },
            { "name": "kw_filter", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('filter') },
            { "name": "kw_commit", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('commit') },
            { "name": "kw_tablespace", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('tablespace') },
            { "name": "kw_transaction", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('transaction') },
            { "name": "kw_work", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('work') },
            { "name": "kw_read", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('read') },
            { "name": "kw_write", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('write') },
            { "name": "kw_isolation", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('isolation') },
            { "name": "kw_level", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('level') },
            { "name": "kw_serializable", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('serializable') },
            { "name": "kw_rollback", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('rollback') },
            { "name": "kw_insert", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('insert') },
            { "name": "kw_value", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('value') },
            { "name": "kw_values", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('values') },
            { "name": "kw_update", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('update') },
            { "name": "kw_set", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('set') },
            { "name": "kw_version", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('version') },
            { "name": "kw_alter", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('alter') },
            { "name": "kw_rename", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('rename') },
            { "name": "kw_sequence", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('sequence') },
            { "name": "kw_temp", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('temp') },
            { "name": "kw_temporary", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('temporary') },
            { "name": "kw_add", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('add') },
            { "name": "kw_owner", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('owner') },
            { "name": "kw_owned", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('owned') },
            { "name": "kw_including", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('including') },
            { "name": "kw_excluding", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('excluding') },
            { "name": "kw_none", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('none') },
            { "name": "kw_drop", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('drop') },
            { "name": "kw_operator", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('operator') },
            { "name": "kw_minvalue", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('minvalue') },
            { "name": "kw_maxvalue", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('maxvalue') },
            { "name": "kw_data", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('data') },
            { "name": "kw_type", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('type') },
            { "name": "kw_delete", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('delete') },
            { "name": "kw_cache", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('cache') },
            { "name": "kw_cascade", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('cascade') },
            { "name": "kw_no", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('no') },
            { "name": "kw_timestamp", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('timestamp') },
            { "name": "kw_cycle", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('cycle') },
            { "name": "kw_function", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('function') },
            { "name": "kw_returns", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('returns') },
            { "name": "kw_language", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('language') },
            { "name": "kw_out", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('out') },
            { "name": "kw_inout", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('inout') },
            { "name": "kw_variadic", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('variadic') },
            { "name": "kw_action", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('action') },
            { "name": "kw_restrict", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('restrict') },
            { "name": "kw_truncate", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('truncate') },
            { "name": "kw_increment", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('increment') },
            { "name": "kw_by", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('by') },
            { "name": "kw_row", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('row') },
            { "name": "kw_rows", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('rows') },
            { "name": "kw_next", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('next') },
            { "name": "kw_match", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('match') },
            { "name": "kw_replace", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('replace') },
            { "name": "kw_recursive", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('recursive') },
            { "name": "kw_view", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('view') },
            { "name": "kw_cascaded", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('cascaded') },
            { "name": "kw_unlogged", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('unlogged') },
            { "name": "kw_global", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('global') },
            { "name": "kw_option", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('option') },
            { "name": "kw_materialized", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('materialized') },
            { "name": "kw_partial", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('partial') },
            { "name": "kw_partition", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('partition') },
            { "name": "kw_simple", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('simple') },
            { "name": "kw_generated", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('generated') },
            { "name": "kw_always", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('always') },
            { "name": "kw_identity", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('identity') },
            { "name": "kw_name", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('name') },
            { "name": "kw_enum", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('enum') },
            { "name": "kw_show", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('show') },
            { "name": "kw_overriding", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('overriding') },
            { "name": "kw_over", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('over') },
            { "name": "kw_system", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('system') },
            { "name": "kw_comment", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('comment') },
            { "name": "kw_time", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('time') },
            { "name": "kw_zone", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('zone') },
            { "name": "kw_interval", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('interval') },
            { "name": "kw_hour", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('hour') },
            { "name": "kw_minute", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('minute') },
            { "name": "kw_local", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('local') },
            { "name": "kw_prepare", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('prepare') },
            { "name": "kw_raise", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('raise') },
            { "name": "kw_continue", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": notReservedKw('continue') },
            { "name": "kw_ifnotexists", "symbols": ["kw_if", (lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not), "kw_exists"] },
            { "name": "kw_ifexists", "symbols": ["kw_if", "kw_exists"] },
            { "name": "kw_not_null", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not), (lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null)] },
            { "name": "kw_primary_key", "symbols": [(lexer_1.lexerAny.has("kw_primary") ? { type: "kw_primary" } : kw_primary), "kw_key"] },
            { "name": "data_type$ebnf$1$subexpression$1$macrocall$2", "symbols": ["int"] },
            { "name": "data_type$ebnf$1$subexpression$1$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "data_type$ebnf$1$subexpression$1$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "data_type$ebnf$1$subexpression$1$macrocall$2"], "postprocess": last },
            { "name": "data_type$ebnf$1$subexpression$1$macrocall$1$ebnf$1", "symbols": ["data_type$ebnf$1$subexpression$1$macrocall$1$ebnf$1", "data_type$ebnf$1$subexpression$1$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "data_type$ebnf$1$subexpression$1$macrocall$1", "symbols": ["data_type$ebnf$1$subexpression$1$macrocall$2", "data_type$ebnf$1$subexpression$1$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "data_type$ebnf$1$subexpression$1", "symbols": ["lparen", "data_type$ebnf$1$subexpression$1$macrocall$1", "rparen"], "postprocess": get(1) },
            { "name": "data_type$ebnf$1", "symbols": ["data_type$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "data_type$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "data_type$ebnf$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_array") ? { type: "kw_array" } : kw_array)] },
            { "name": "data_type$ebnf$2$subexpression$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("lbracket") ? { type: "lbracket" } : lbracket), (lexer_1.lexerAny.has("rbracket") ? { type: "rbracket" } : rbracket)] },
            { "name": "data_type$ebnf$2$subexpression$1$ebnf$1", "symbols": ["data_type$ebnf$2$subexpression$1$ebnf$1$subexpression$1"] },
            { "name": "data_type$ebnf$2$subexpression$1$ebnf$1$subexpression$2", "symbols": [(lexer_1.lexerAny.has("lbracket") ? { type: "lbracket" } : lbracket), (lexer_1.lexerAny.has("rbracket") ? { type: "rbracket" } : rbracket)] },
            { "name": "data_type$ebnf$2$subexpression$1$ebnf$1", "symbols": ["data_type$ebnf$2$subexpression$1$ebnf$1", "data_type$ebnf$2$subexpression$1$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "data_type$ebnf$2$subexpression$1", "symbols": ["data_type$ebnf$2$subexpression$1$ebnf$1"] },
            { "name": "data_type$ebnf$2", "symbols": ["data_type$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "data_type$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "data_type", "symbols": ["data_type_simple", "data_type$ebnf$1", "data_type$ebnf$2"], "postprocess": x => {
                    let asArray = x[2];
                    const name = unwrap(x[0]);
                    let ret;
                    ret = {
                        ...name,
                        ...Array.isArray(x[1]) && x[1].length ? { config: x[1].map(unwrap) } : {},
                    };
                    if (asArray) {
                        if (asArray[0].type === 'kw_array') {
                            asArray = [['array']];
                        }
                        for (const _ of asArray[0]) {
                            ret = {
                                kind: 'array',
                                arrayOf: ret,
                            };
                        }
                    }
                    return lexer_2.track(x, ret);
                } },
            { "name": "data_type_list$ebnf$1", "symbols": [] },
            { "name": "data_type_list$ebnf$1$subexpression$1", "symbols": ["comma", "data_type"], "postprocess": last },
            { "name": "data_type_list$ebnf$1", "symbols": ["data_type_list$ebnf$1", "data_type_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "data_type_list", "symbols": ["data_type", "data_type_list$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "data_type_simple", "symbols": ["data_type_text"], "postprocess": x => lexer_2.track(x, { name: toStr(x, ' ') }) },
            { "name": "data_type_simple", "symbols": ["data_type_numeric"], "postprocess": x => lexer_2.track(x, { name: toStr(x, ' ') }) },
            { "name": "data_type_simple", "symbols": ["data_type_date"], "postprocess": x => lexer_2.track(x, { name: toStr(x, ' ') }) },
            { "name": "data_type_simple", "symbols": ["qualified_name"] },
            { "name": "data_type_numeric$subexpression$1", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": kw('double') },
            { "name": "data_type_numeric", "symbols": ["data_type_numeric$subexpression$1", (lexer_1.lexerAny.has("kw_precision") ? { type: "kw_precision" } : kw_precision)] },
            { "name": "data_type_text$subexpression$1", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": anyKw('character', 'bit') },
            { "name": "data_type_text$subexpression$2", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": kw('varying') },
            { "name": "data_type_text", "symbols": ["data_type_text$subexpression$1", "data_type_text$subexpression$2"] },
            { "name": "data_type_date$subexpression$1", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": anyKw('timestamp', 'time') },
            { "name": "data_type_date$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with)] },
            { "name": "data_type_date$subexpression$2", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": kw('without') },
            { "name": "data_type_date$subexpression$3", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": kw('time') },
            { "name": "data_type_date$subexpression$4", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": kw('zone') },
            { "name": "data_type_date", "symbols": ["data_type_date$subexpression$1", "data_type_date$subexpression$2", "data_type_date$subexpression$3", "data_type_date$subexpression$4"] },
            { "name": "ident_aliased$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "ident"], "postprocess": last },
            { "name": "ident_aliased", "symbols": ["ident_aliased$subexpression$1"] },
            { "name": "ident_aliased", "symbols": ["ident"], "postprocess": unwrap },
            { "name": "table_ref", "symbols": ["qualified_name"], "postprocess": unwrap },
            { "name": "qcolumn$ebnf$1$subexpression$1", "symbols": ["dot", "ident"], "postprocess": last },
            { "name": "qcolumn$ebnf$1", "symbols": ["qcolumn$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "qcolumn$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "qcolumn", "symbols": ["ident", "dot", "ident", "qcolumn$ebnf$1"], "postprocess": x => {
                    if (!x[3]) {
                        return lexer_2.track(x, {
                            table: lexer_2.unbox(x[0]),
                            column: lexer_2.unbox(x[2]),
                        });
                    }
                    return lexer_2.track(x, {
                        schema: lexer_2.unbox(x[0]),
                        table: lexer_2.unbox(x[2]),
                        column: lexer_2.unbox(x[3]),
                    });
                } },
            { "name": "table_ref_aliased$ebnf$1", "symbols": ["ident_aliased"], "postprocess": id },
            { "name": "table_ref_aliased$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "table_ref_aliased", "symbols": ["table_ref", "table_ref_aliased$ebnf$1"], "postprocess": x => {
                    const alias = unwrap(x[1]);
                    return lexer_2.track(x, {
                        ...unwrap(x[0]),
                        ...alias ? { alias } : {},
                    });
                } },
            { "name": "qualified_name$ebnf$1$subexpression$1", "symbols": ["ident", "dot"], "postprocess": get(0) },
            { "name": "qualified_name$ebnf$1", "symbols": ["qualified_name$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "qualified_name$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "qualified_name", "symbols": ["qualified_name$ebnf$1", "ident"], "postprocess": x => {
                    const schema = lexer_2.unbox(x[0]);
                    const name = lexer_2.unbox(x[1]);
                    if (schema) {
                        return lexer_2.track(x, { name, schema });
                    }
                    return lexer_2.track(x, { name });
                } },
            { "name": "qualified_name", "symbols": [(lexer_1.lexerAny.has("kw_current_schema") ? { type: "kw_current_schema" } : kw_current_schema)], "postprocess": x => lexer_2.track(x, { name: 'current_schema' }) },
            { "name": "qname", "symbols": ["qualified_name"], "postprocess": unwrap },
            { "name": "select_statement$ebnf$1", "symbols": ["select_from"], "postprocess": id },
            { "name": "select_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_statement$ebnf$2", "symbols": ["select_where"], "postprocess": id },
            { "name": "select_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "select_statement$ebnf$3", "symbols": ["select_groupby"], "postprocess": id },
            { "name": "select_statement$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "select_statement$ebnf$4", "symbols": ["select_order_by"], "postprocess": id },
            { "name": "select_statement$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "select_statement", "symbols": ["select_what", "select_statement$ebnf$1", "select_statement$ebnf$2", "select_statement$ebnf$3", "select_statement$ebnf$4", "select_limit"], "postprocess": x => {
                    let [what, from, where, groupBy, orderBy, limit] = x;
                    from = unwrap(from);
                    groupBy = groupBy && (groupBy.length === 1 && groupBy[0].type === 'list' ? groupBy[0].expressions : groupBy);
                    return lexer_2.track(x, {
                        ...what,
                        ...from ? { from: Array.isArray(from) ? from : [from] } : {},
                        ...groupBy ? { groupBy } : {},
                        ...limit ? { limit } : {},
                        ...orderBy ? { orderBy } : {},
                        ...where ? { where } : {},
                        type: 'select',
                    });
                } },
            { "name": "select_from", "symbols": [(lexer_1.lexerAny.has("kw_from") ? { type: "kw_from" } : kw_from), "select_subject"], "postprocess": last },
            { "name": "select_subject", "symbols": ["select_table_base"], "postprocess": get(0) },
            { "name": "select_subject", "symbols": ["select_subject_joins"], "postprocess": get(0) },
            { "name": "select_subject", "symbols": ["lparen", "select_subject_joins", "rparen"], "postprocess": get(1) },
            { "name": "select_subject_joins$ebnf$1", "symbols": ["select_table_join"] },
            { "name": "select_subject_joins$ebnf$1", "symbols": ["select_subject_joins$ebnf$1", "select_table_join"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "select_subject_joins", "symbols": ["select_table_base", "select_subject_joins$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "select_table_base", "symbols": ["stb_table"], "postprocess": unwrap },
            { "name": "select_table_base", "symbols": ["stb_statement"], "postprocess": unwrap },
            { "name": "select_table_base", "symbols": ["stb_call"], "postprocess": unwrap },
            { "name": "stb_opts$ebnf$1", "symbols": ["collist_paren"], "postprocess": id },
            { "name": "stb_opts$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "stb_opts", "symbols": ["ident_aliased", "stb_opts$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    alias: toStr(x[0]),
                    ...x[1] && { columnNames: lexer_2.unbox(x[1]).map(asName) },
                }) },
            { "name": "stb_table$ebnf$1", "symbols": ["stb_opts"], "postprocess": id },
            { "name": "stb_table$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "stb_table", "symbols": ["table_ref", "stb_table$ebnf$1"], "postprocess": x => {
                    return lexer_2.track(x, {
                        type: 'table',
                        name: lexer_2.track(x, {
                            ...x[0],
                            ...x[1],
                        }),
                    });
                } },
            { "name": "stb_statement", "symbols": ["selection_paren", "stb_opts"], "postprocess": x => lexer_2.track(x, {
                    type: 'statement',
                    statement: unwrap(x[0]),
                    ...x[1],
                }) },
            { "name": "select_values", "symbols": ["kw_values", "insert_values"], "postprocess": x => lexer_2.track(x, {
                    type: 'values',
                    values: x[1],
                }) },
            { "name": "stb_call$ebnf$1$subexpression$1$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as)], "postprocess": id },
            { "name": "stb_call$ebnf$1$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "stb_call$ebnf$1$subexpression$1", "symbols": ["stb_call$ebnf$1$subexpression$1$ebnf$1", "ident"], "postprocess": last },
            { "name": "stb_call$ebnf$1", "symbols": ["stb_call$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "stb_call$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "stb_call", "symbols": ["expr_call", "stb_call$ebnf$1"], "postprocess": x => !x[1]
                    ? x[0]
                    : lexer_2.track(x, {
                        ...x[0],
                        alias: asName(x[1]),
                    }) },
            { "name": "select_table_join$ebnf$1", "symbols": ["select_table_join_clause"], "postprocess": id },
            { "name": "select_table_join$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_table_join", "symbols": ["select_join_op", (lexer_1.lexerAny.has("kw_join") ? { type: "kw_join" } : kw_join), "select_table_base", "select_table_join$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    ...unwrap(x[2]),
                    join: {
                        type: toStr(x[0], ' '),
                        ...x[3] && unwrap(x[3]),
                    }
                }) },
            { "name": "select_table_join_clause", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "expr"], "postprocess": x => lexer_2.track(x, { on: last(x) }) },
            { "name": "select_table_join_clause$macrocall$2", "symbols": ["ident"] },
            { "name": "select_table_join_clause$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "select_table_join_clause$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "select_table_join_clause$macrocall$2"], "postprocess": last },
            { "name": "select_table_join_clause$macrocall$1$ebnf$1", "symbols": ["select_table_join_clause$macrocall$1$ebnf$1", "select_table_join_clause$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "select_table_join_clause$macrocall$1", "symbols": ["select_table_join_clause$macrocall$2", "select_table_join_clause$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "select_table_join_clause", "symbols": [(lexer_1.lexerAny.has("kw_using") ? { type: "kw_using" } : kw_using), "lparen", "select_table_join_clause$macrocall$1", "rparen"], "postprocess": x => lexer_2.track(x, { using: x[2].map(asName) }) },
            { "name": "select_join_op$subexpression$1$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_inner") ? { type: "kw_inner" } : kw_inner)], "postprocess": id },
            { "name": "select_join_op$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_join_op$subexpression$1", "symbols": ["select_join_op$subexpression$1$ebnf$1"], "postprocess": x => lexer_2.box(x, 'INNER JOIN') },
            { "name": "select_join_op", "symbols": ["select_join_op$subexpression$1"] },
            { "name": "select_join_op$subexpression$2$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_outer") ? { type: "kw_outer" } : kw_outer)], "postprocess": id },
            { "name": "select_join_op$subexpression$2$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_join_op$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_left") ? { type: "kw_left" } : kw_left), "select_join_op$subexpression$2$ebnf$1"], "postprocess": x => lexer_2.box(x, 'LEFT JOIN') },
            { "name": "select_join_op", "symbols": ["select_join_op$subexpression$2"] },
            { "name": "select_join_op$subexpression$3$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_outer") ? { type: "kw_outer" } : kw_outer)], "postprocess": id },
            { "name": "select_join_op$subexpression$3$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_join_op$subexpression$3", "symbols": [(lexer_1.lexerAny.has("kw_right") ? { type: "kw_right" } : kw_right), "select_join_op$subexpression$3$ebnf$1"], "postprocess": x => lexer_2.box(x, 'RIGHT JOIN') },
            { "name": "select_join_op", "symbols": ["select_join_op$subexpression$3"] },
            { "name": "select_join_op$subexpression$4$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_outer") ? { type: "kw_outer" } : kw_outer)], "postprocess": id },
            { "name": "select_join_op$subexpression$4$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_join_op$subexpression$4", "symbols": [(lexer_1.lexerAny.has("kw_full") ? { type: "kw_full" } : kw_full), "select_join_op$subexpression$4$ebnf$1"], "postprocess": x => lexer_2.box(x, 'FULL JOIN') },
            { "name": "select_join_op", "symbols": ["select_join_op$subexpression$4"] },
            { "name": "select_what$ebnf$1", "symbols": ["select_distinct"], "postprocess": id },
            { "name": "select_what$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_what$ebnf$2", "symbols": ["select_expr_list_aliased"], "postprocess": id },
            { "name": "select_what$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "select_what", "symbols": [(lexer_1.lexerAny.has("kw_select") ? { type: "kw_select" } : kw_select), "select_what$ebnf$1", "select_what$ebnf$2"], "postprocess": x => lexer_2.track(x, {
                    columns: x[2],
                    ...x[1] && { distinct: lexer_2.unbox(x[1]) },
                }) },
            { "name": "select_expr_list_aliased$ebnf$1", "symbols": [] },
            { "name": "select_expr_list_aliased$ebnf$1$subexpression$1", "symbols": ["comma", "select_expr_list_item"], "postprocess": last },
            { "name": "select_expr_list_aliased$ebnf$1", "symbols": ["select_expr_list_aliased$ebnf$1", "select_expr_list_aliased$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "select_expr_list_aliased", "symbols": ["select_expr_list_item", "select_expr_list_aliased$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "select_expr_list_item$ebnf$1", "symbols": ["ident_aliased"], "postprocess": id },
            { "name": "select_expr_list_item$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_expr_list_item", "symbols": ["expr", "select_expr_list_item$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    expr: x[0],
                    ...x[1] ? { alias: asName(x[1]) } : {},
                }) },
            { "name": "select_distinct", "symbols": [(lexer_1.lexerAny.has("kw_all") ? { type: "kw_all" } : kw_all)], "postprocess": x => lexer_2.box(x, 'all') },
            { "name": "select_distinct$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "lparen", "expr_list_raw", "rparen"], "postprocess": get(2) },
            { "name": "select_distinct$ebnf$1", "symbols": ["select_distinct$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "select_distinct$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_distinct", "symbols": [(lexer_1.lexerAny.has("kw_distinct") ? { type: "kw_distinct" } : kw_distinct), "select_distinct$ebnf$1"], "postprocess": x => lexer_2.box(x, x[1] || 'distinct') },
            { "name": "select_where", "symbols": [(lexer_1.lexerAny.has("kw_where") ? { type: "kw_where" } : kw_where), "expr"], "postprocess": last },
            { "name": "select_groupby", "symbols": [(lexer_1.lexerAny.has("kw_group") ? { type: "kw_group" } : kw_group), "kw_by", "expr_list_raw"], "postprocess": last },
            { "name": "select_limit$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_limit") ? { type: "kw_limit" } : kw_limit), "expr_nostar"], "postprocess": last },
            { "name": "select_limit$ebnf$1", "symbols": ["select_limit$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "select_limit$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_limit$ebnf$2$subexpression$1$ebnf$1$subexpression$1", "symbols": ["kw_row"] },
            { "name": "select_limit$ebnf$2$subexpression$1$ebnf$1$subexpression$1", "symbols": ["kw_rows"] },
            { "name": "select_limit$ebnf$2$subexpression$1$ebnf$1", "symbols": ["select_limit$ebnf$2$subexpression$1$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "select_limit$ebnf$2$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_limit$ebnf$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_offset") ? { type: "kw_offset" } : kw_offset), "expr_nostar", "select_limit$ebnf$2$subexpression$1$ebnf$1"], "postprocess": get(1) },
            { "name": "select_limit$ebnf$2", "symbols": ["select_limit$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "select_limit$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$1$subexpression$1", "symbols": ["kw_first"] },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$1$subexpression$1", "symbols": ["kw_next"] },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$1", "symbols": ["select_limit$ebnf$3$subexpression$1$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$2$subexpression$1", "symbols": ["kw_row"] },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$2$subexpression$1", "symbols": ["kw_rows"] },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$2", "symbols": ["select_limit$ebnf$3$subexpression$1$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "select_limit$ebnf$3$subexpression$1$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "select_limit$ebnf$3$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_fetch") ? { type: "kw_fetch" } : kw_fetch), "select_limit$ebnf$3$subexpression$1$ebnf$1", "expr_nostar", "select_limit$ebnf$3$subexpression$1$ebnf$2"], "postprocess": get(2) },
            { "name": "select_limit$ebnf$3", "symbols": ["select_limit$ebnf$3$subexpression$1"], "postprocess": id },
            { "name": "select_limit$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "select_limit", "symbols": ["select_limit$ebnf$1", "select_limit$ebnf$2", "select_limit$ebnf$3"], "postprocess": (x, _, rej) => {
                    const limit1 = lexer_2.unbox(x[0]);
                    const offset = lexer_2.unbox(x[1]);
                    const limit2 = lexer_2.unbox(x[2]);
                    if (limit1 && limit2) {
                        return rej;
                    }
                    if (!limit1 && !limit2 && !offset) {
                        return null;
                    }
                    const limit = limit1 || limit2;
                    return lexer_2.track(x, {
                        ...limit ? { limit } : {},
                        ...offset ? { offset } : {},
                    });
                } },
            { "name": "select_order_by$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_order") ? { type: "kw_order" } : kw_order), "kw_by"] },
            { "name": "select_order_by$ebnf$1", "symbols": [] },
            { "name": "select_order_by$ebnf$1$subexpression$1", "symbols": ["comma", "select_order_by_expr"], "postprocess": last },
            { "name": "select_order_by$ebnf$1", "symbols": ["select_order_by$ebnf$1", "select_order_by$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "select_order_by", "symbols": ["select_order_by$subexpression$1", "select_order_by_expr", "select_order_by$ebnf$1"], "postprocess": ([_, head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "select_order_by_expr$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_asc") ? { type: "kw_asc" } : kw_asc)] },
            { "name": "select_order_by_expr$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_desc") ? { type: "kw_desc" } : kw_desc)] },
            { "name": "select_order_by_expr$ebnf$1", "symbols": ["select_order_by_expr$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "select_order_by_expr$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "select_order_by_expr", "symbols": ["expr", "select_order_by_expr$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    by: x[0],
                    ...x[1] && { order: toStr(x[1]).toUpperCase() },
                }) },
            { "name": "expr", "symbols": ["expr_nostar"], "postprocess": unwrap },
            { "name": "expr", "symbols": ["expr_star"], "postprocess": unwrap },
            { "name": "expr_nostar", "symbols": ["expr_paren"], "postprocess": unwrap },
            { "name": "expr_nostar", "symbols": ["expr_or"], "postprocess": unwrap },
            { "name": "expr_paren$subexpression$1", "symbols": ["expr_or_select"] },
            { "name": "expr_paren$subexpression$1", "symbols": ["expr_list_many"] },
            { "name": "expr_paren", "symbols": ["lparen", "expr_paren$subexpression$1", "rparen"], "postprocess": get(1) },
            { "name": "expr_or$macrocall$2$macrocall$2", "symbols": [(lexer_1.lexerAny.has("kw_or") ? { type: "kw_or" } : kw_or)] },
            { "name": "expr_or$macrocall$2$macrocall$1", "symbols": ["expr_or$macrocall$2$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_or$macrocall$2", "symbols": ["expr_or$macrocall$2$macrocall$1"] },
            { "name": "expr_or$macrocall$3", "symbols": ["expr_or"] },
            { "name": "expr_or$macrocall$4", "symbols": ["expr_and"] },
            { "name": "expr_or$macrocall$1$subexpression$1", "symbols": ["expr_or$macrocall$3"] },
            { "name": "expr_or$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_or$macrocall$1$subexpression$2", "symbols": ["expr_or$macrocall$4"] },
            { "name": "expr_or$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_or$macrocall$1", "symbols": ["expr_or$macrocall$1$subexpression$1", "expr_or$macrocall$2", "expr_or$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_or$macrocall$1", "symbols": ["expr_or$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_or", "symbols": ["expr_or$macrocall$1"] },
            { "name": "expr_and$macrocall$2$macrocall$2", "symbols": [(lexer_1.lexerAny.has("kw_and") ? { type: "kw_and" } : kw_and)] },
            { "name": "expr_and$macrocall$2$macrocall$1", "symbols": ["expr_and$macrocall$2$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_and$macrocall$2", "symbols": ["expr_and$macrocall$2$macrocall$1"] },
            { "name": "expr_and$macrocall$3", "symbols": ["expr_and"] },
            { "name": "expr_and$macrocall$4", "symbols": ["expr_not"] },
            { "name": "expr_and$macrocall$1$subexpression$1", "symbols": ["expr_and$macrocall$3"] },
            { "name": "expr_and$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_and$macrocall$1$subexpression$2", "symbols": ["expr_and$macrocall$4"] },
            { "name": "expr_and$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_and$macrocall$1", "symbols": ["expr_and$macrocall$1$subexpression$1", "expr_and$macrocall$2", "expr_and$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_and$macrocall$1", "symbols": ["expr_and$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_and", "symbols": ["expr_and$macrocall$1"] },
            { "name": "expr_not$macrocall$2$macrocall$2", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)] },
            { "name": "expr_not$macrocall$2$macrocall$1", "symbols": ["expr_not$macrocall$2$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_not$macrocall$2", "symbols": ["expr_not$macrocall$2$macrocall$1"] },
            { "name": "expr_not$macrocall$3", "symbols": ["expr_not"] },
            { "name": "expr_not$macrocall$4", "symbols": ["expr_eq"] },
            { "name": "expr_not$macrocall$1$subexpression$1", "symbols": ["expr_not$macrocall$3"] },
            { "name": "expr_not$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_not$macrocall$1", "symbols": ["expr_not$macrocall$2", "expr_not$macrocall$1$subexpression$1"], "postprocess": x => lexer_2.track(x, {
                    type: 'unary',
                    ...unwrap(x[0]),
                    operand: unwrap(x[1]),
                }) },
            { "name": "expr_not$macrocall$1", "symbols": ["expr_not$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_not", "symbols": ["expr_not$macrocall$1"] },
            { "name": "expr_eq$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_eq") ? { type: "op_eq" } : op_eq)] },
            { "name": "expr_eq$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_neq") ? { type: "op_neq" } : op_neq)] },
            { "name": "expr_eq$macrocall$2$macrocall$2", "symbols": ["expr_eq$macrocall$2$macrocall$2$subexpression$1"] },
            { "name": "expr_eq$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_eq$macrocall$2$macrocall$2"] },
            { "name": "expr_eq$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_eq$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_eq$macrocall$2$macrocall$1", "symbols": ["expr_eq$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_eq$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_eq$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_eq$macrocall$2", "symbols": ["expr_eq$macrocall$2$macrocall$1"] },
            { "name": "expr_eq$macrocall$3", "symbols": ["expr_eq"] },
            { "name": "expr_eq$macrocall$4", "symbols": ["expr_is"] },
            { "name": "expr_eq$macrocall$1$subexpression$1", "symbols": ["expr_eq$macrocall$3"] },
            { "name": "expr_eq$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_eq$macrocall$1$subexpression$2", "symbols": ["expr_eq$macrocall$4"] },
            { "name": "expr_eq$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_eq$macrocall$1", "symbols": ["expr_eq$macrocall$1$subexpression$1", "expr_eq$macrocall$2", "expr_eq$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_eq$macrocall$1", "symbols": ["expr_eq$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_eq", "symbols": ["expr_eq$macrocall$1"] },
            { "name": "expr_star", "symbols": ["star"], "postprocess": x => lexer_2.track(x, { type: 'ref', name: '*' }) },
            { "name": "expr_is$subexpression$1", "symbols": ["expr_is"] },
            { "name": "expr_is$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_is$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_isnull") ? { type: "kw_isnull" } : kw_isnull)] },
            { "name": "expr_is$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_is") ? { type: "kw_is" } : kw_is), (lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null)] },
            { "name": "expr_is", "symbols": ["expr_is$subexpression$1", "expr_is$subexpression$2"], "postprocess": x => lexer_2.track(x, { type: 'unary', op: 'IS NULL', operand: unwrap(x[0]) }) },
            { "name": "expr_is$subexpression$3", "symbols": ["expr_is"] },
            { "name": "expr_is$subexpression$3", "symbols": ["expr_paren"] },
            { "name": "expr_is$subexpression$4", "symbols": [(lexer_1.lexerAny.has("kw_notnull") ? { type: "kw_notnull" } : kw_notnull)] },
            { "name": "expr_is$subexpression$4", "symbols": [(lexer_1.lexerAny.has("kw_is") ? { type: "kw_is" } : kw_is), "kw_not_null"] },
            { "name": "expr_is", "symbols": ["expr_is$subexpression$3", "expr_is$subexpression$4"], "postprocess": x => lexer_2.track(x, { type: 'unary', op: 'IS NOT NULL', operand: unwrap(x[0]) }) },
            { "name": "expr_is$subexpression$5", "symbols": ["expr_is"] },
            { "name": "expr_is$subexpression$5", "symbols": ["expr_paren"] },
            { "name": "expr_is$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)], "postprocess": id },
            { "name": "expr_is$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_is$subexpression$6", "symbols": [(lexer_1.lexerAny.has("kw_true") ? { type: "kw_true" } : kw_true)] },
            { "name": "expr_is$subexpression$6", "symbols": [(lexer_1.lexerAny.has("kw_false") ? { type: "kw_false" } : kw_false)] },
            { "name": "expr_is", "symbols": ["expr_is$subexpression$5", (lexer_1.lexerAny.has("kw_is") ? { type: "kw_is" } : kw_is), "expr_is$ebnf$1", "expr_is$subexpression$6"], "postprocess": x => lexer_2.track(x, {
                    type: 'unary',
                    op: 'IS ' + flattenStr([x[2], x[3]])
                        .join(' ')
                        .toUpperCase(),
                    operand: unwrap(x[0]),
                }) },
            { "name": "expr_is", "symbols": ["expr_compare"], "postprocess": unwrap },
            { "name": "expr_compare$macrocall$2$macrocall$2", "symbols": [(lexer_1.lexerAny.has("op_compare") ? { type: "op_compare" } : op_compare)] },
            { "name": "expr_compare$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_compare$macrocall$2$macrocall$2"] },
            { "name": "expr_compare$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_compare$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_compare$macrocall$2$macrocall$1", "symbols": ["expr_compare$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_compare$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_compare$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_compare$macrocall$2", "symbols": ["expr_compare$macrocall$2$macrocall$1"] },
            { "name": "expr_compare$macrocall$3", "symbols": ["expr_compare"] },
            { "name": "expr_compare$macrocall$4", "symbols": ["expr_range"] },
            { "name": "expr_compare$macrocall$1$subexpression$1", "symbols": ["expr_compare$macrocall$3"] },
            { "name": "expr_compare$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_compare$macrocall$1$subexpression$2", "symbols": ["expr_compare$macrocall$4"] },
            { "name": "expr_compare$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_compare$macrocall$1", "symbols": ["expr_compare$macrocall$1$subexpression$1", "expr_compare$macrocall$2", "expr_compare$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_compare$macrocall$1", "symbols": ["expr_compare$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_compare", "symbols": ["expr_compare$macrocall$1"] },
            { "name": "expr_range$macrocall$2", "symbols": ["ops_between"] },
            { "name": "expr_range$macrocall$3", "symbols": [(lexer_1.lexerAny.has("kw_and") ? { type: "kw_and" } : kw_and)] },
            { "name": "expr_range$macrocall$4", "symbols": ["expr_range"] },
            { "name": "expr_range$macrocall$5", "symbols": ["expr_others"] },
            { "name": "expr_range$macrocall$1$subexpression$1", "symbols": ["expr_range$macrocall$4"] },
            { "name": "expr_range$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_range$macrocall$1$subexpression$2", "symbols": ["expr_range$macrocall$4"] },
            { "name": "expr_range$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_range$macrocall$1$subexpression$3", "symbols": ["expr_range$macrocall$5"] },
            { "name": "expr_range$macrocall$1$subexpression$3", "symbols": ["expr_paren"] },
            { "name": "expr_range$macrocall$1", "symbols": ["expr_range$macrocall$1$subexpression$1", "expr_range$macrocall$2", "expr_range$macrocall$1$subexpression$2", "expr_range$macrocall$3", "expr_range$macrocall$1$subexpression$3"], "postprocess": x => lexer_2.track(x, {
                    type: 'ternary',
                    value: unwrap(x[0]),
                    lo: unwrap(x[2]),
                    hi: unwrap(x[4]),
                    op: (flattenStr(x[1]).join(' ') || '<error>').toUpperCase(),
                }) },
            { "name": "expr_range$macrocall$1", "symbols": ["expr_range$macrocall$5"], "postprocess": unwrap },
            { "name": "expr_range", "symbols": ["expr_range$macrocall$1"] },
            { "name": "expr_others$macrocall$2$macrocall$2", "symbols": [(lexer_1.lexerAny.has("ops_others") ? { type: "ops_others" } : ops_others)] },
            { "name": "expr_others$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_others$macrocall$2$macrocall$2"] },
            { "name": "expr_others$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_others$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_others$macrocall$2$macrocall$1", "symbols": ["expr_others$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_others$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_others$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_others$macrocall$2", "symbols": ["expr_others$macrocall$2$macrocall$1"] },
            { "name": "expr_others$macrocall$3", "symbols": ["expr_others"] },
            { "name": "expr_others$macrocall$4", "symbols": ["expr_like"] },
            { "name": "expr_others$macrocall$1$subexpression$1", "symbols": ["expr_others$macrocall$3"] },
            { "name": "expr_others$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_others$macrocall$1$subexpression$2", "symbols": ["expr_others$macrocall$4"] },
            { "name": "expr_others$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_others$macrocall$1", "symbols": ["expr_others$macrocall$1$subexpression$1", "expr_others$macrocall$2", "expr_others$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_others$macrocall$1", "symbols": ["expr_others$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_others", "symbols": ["expr_others$macrocall$1"] },
            { "name": "expr_like$macrocall$2$macrocall$2", "symbols": ["ops_like"] },
            { "name": "expr_like$macrocall$2$macrocall$1", "symbols": ["expr_like$macrocall$2$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_like$macrocall$2", "symbols": ["expr_like$macrocall$2$macrocall$1"] },
            { "name": "expr_like$macrocall$3", "symbols": ["expr_like"] },
            { "name": "expr_like$macrocall$4", "symbols": ["expr_in"] },
            { "name": "expr_like$macrocall$1$subexpression$1", "symbols": ["expr_like$macrocall$3"] },
            { "name": "expr_like$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_like$macrocall$1$subexpression$2", "symbols": ["expr_like$macrocall$4"] },
            { "name": "expr_like$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_like$macrocall$1", "symbols": ["expr_like$macrocall$1$subexpression$1", "expr_like$macrocall$2", "expr_like$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_like$macrocall$1", "symbols": ["expr_like$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_like", "symbols": ["expr_like$macrocall$1"] },
            { "name": "expr_in$macrocall$2$macrocall$2", "symbols": ["ops_in"] },
            { "name": "expr_in$macrocall$2$macrocall$1", "symbols": ["expr_in$macrocall$2$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_in$macrocall$2", "symbols": ["expr_in$macrocall$2$macrocall$1"] },
            { "name": "expr_in$macrocall$3", "symbols": ["expr_in"] },
            { "name": "expr_in$macrocall$4", "symbols": ["expr_add"] },
            { "name": "expr_in$macrocall$1$subexpression$1", "symbols": ["expr_in$macrocall$3"] },
            { "name": "expr_in$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_in$macrocall$1$subexpression$2", "symbols": ["expr_in$macrocall$4"] },
            { "name": "expr_in$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_in$macrocall$1", "symbols": ["expr_in$macrocall$1$subexpression$1", "expr_in$macrocall$2", "expr_in$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_in$macrocall$1", "symbols": ["expr_in$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_in", "symbols": ["expr_in$macrocall$1"] },
            { "name": "expr_add$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_plus") ? { type: "op_plus" } : op_plus)] },
            { "name": "expr_add$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_minus") ? { type: "op_minus" } : op_minus)] },
            { "name": "expr_add$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_additive") ? { type: "op_additive" } : op_additive)] },
            { "name": "expr_add$macrocall$2$macrocall$2", "symbols": ["expr_add$macrocall$2$macrocall$2$subexpression$1"] },
            { "name": "expr_add$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_add$macrocall$2$macrocall$2"] },
            { "name": "expr_add$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_add$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_add$macrocall$2$macrocall$1", "symbols": ["expr_add$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_add$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_add$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_add$macrocall$2", "symbols": ["expr_add$macrocall$2$macrocall$1"] },
            { "name": "expr_add$macrocall$3", "symbols": ["expr_add"] },
            { "name": "expr_add$macrocall$4", "symbols": ["expr_mult"] },
            { "name": "expr_add$macrocall$1$subexpression$1", "symbols": ["expr_add$macrocall$3"] },
            { "name": "expr_add$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_add$macrocall$1$subexpression$2", "symbols": ["expr_add$macrocall$4"] },
            { "name": "expr_add$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_add$macrocall$1", "symbols": ["expr_add$macrocall$1$subexpression$1", "expr_add$macrocall$2", "expr_add$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_add$macrocall$1", "symbols": ["expr_add$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_add", "symbols": ["expr_add$macrocall$1"] },
            { "name": "expr_mult$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("star") ? { type: "star" } : star)] },
            { "name": "expr_mult$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_div") ? { type: "op_div" } : op_div)] },
            { "name": "expr_mult$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_mod") ? { type: "op_mod" } : op_mod)] },
            { "name": "expr_mult$macrocall$2$macrocall$2", "symbols": ["expr_mult$macrocall$2$macrocall$2$subexpression$1"] },
            { "name": "expr_mult$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_mult$macrocall$2$macrocall$2"] },
            { "name": "expr_mult$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_mult$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_mult$macrocall$2$macrocall$1", "symbols": ["expr_mult$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_mult$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_mult$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_mult$macrocall$2", "symbols": ["expr_mult$macrocall$2$macrocall$1"] },
            { "name": "expr_mult$macrocall$3", "symbols": ["expr_mult"] },
            { "name": "expr_mult$macrocall$4", "symbols": ["expr_exp"] },
            { "name": "expr_mult$macrocall$1$subexpression$1", "symbols": ["expr_mult$macrocall$3"] },
            { "name": "expr_mult$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_mult$macrocall$1$subexpression$2", "symbols": ["expr_mult$macrocall$4"] },
            { "name": "expr_mult$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_mult$macrocall$1", "symbols": ["expr_mult$macrocall$1$subexpression$1", "expr_mult$macrocall$2", "expr_mult$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_mult$macrocall$1", "symbols": ["expr_mult$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_mult", "symbols": ["expr_mult$macrocall$1"] },
            { "name": "expr_exp$macrocall$2$macrocall$2", "symbols": [(lexer_1.lexerAny.has("op_exp") ? { type: "op_exp" } : op_exp)] },
            { "name": "expr_exp$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_exp$macrocall$2$macrocall$2"] },
            { "name": "expr_exp$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_exp$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_exp$macrocall$2$macrocall$1", "symbols": ["expr_exp$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_exp$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_exp$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_exp$macrocall$2", "symbols": ["expr_exp$macrocall$2$macrocall$1"] },
            { "name": "expr_exp$macrocall$3", "symbols": ["expr_exp"] },
            { "name": "expr_exp$macrocall$4", "symbols": ["expr_unary_add"] },
            { "name": "expr_exp$macrocall$1$subexpression$1", "symbols": ["expr_exp$macrocall$3"] },
            { "name": "expr_exp$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_exp$macrocall$1$subexpression$2", "symbols": ["expr_exp$macrocall$4"] },
            { "name": "expr_exp$macrocall$1$subexpression$2", "symbols": ["expr_paren"] },
            { "name": "expr_exp$macrocall$1", "symbols": ["expr_exp$macrocall$1$subexpression$1", "expr_exp$macrocall$2", "expr_exp$macrocall$1$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'binary',
                    left: unwrap(x[0]),
                    right: unwrap(x[2]),
                    ...unwrap(x[1]),
                }) },
            { "name": "expr_exp$macrocall$1", "symbols": ["expr_exp$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_exp", "symbols": ["expr_exp$macrocall$1"] },
            { "name": "expr_unary_add$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_plus") ? { type: "op_plus" } : op_plus)] },
            { "name": "expr_unary_add$macrocall$2$macrocall$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_minus") ? { type: "op_minus" } : op_minus)] },
            { "name": "expr_unary_add$macrocall$2$macrocall$2", "symbols": ["expr_unary_add$macrocall$2$macrocall$2$subexpression$1"] },
            { "name": "expr_unary_add$macrocall$2$macrocall$1$macrocall$2", "symbols": ["expr_unary_add$macrocall$2$macrocall$2"] },
            { "name": "expr_unary_add$macrocall$2$macrocall$1$macrocall$1", "symbols": ["expr_unary_add$macrocall$2$macrocall$1$macrocall$2"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x, ' ') || '<error>').toUpperCase()
                }) },
            { "name": "expr_unary_add$macrocall$2$macrocall$1", "symbols": ["expr_unary_add$macrocall$2$macrocall$1$macrocall$1"], "postprocess": unwrap },
            { "name": "expr_unary_add$macrocall$2$macrocall$1", "symbols": ["kw_operator", "lparen", "ident", "dot", "expr_unary_add$macrocall$2$macrocall$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    op: (toStr(x[4], ' ') || '<error>').toUpperCase(),
                    opSchema: toStr(x[2]),
                }) },
            { "name": "expr_unary_add$macrocall$2", "symbols": ["expr_unary_add$macrocall$2$macrocall$1"] },
            { "name": "expr_unary_add$macrocall$3", "symbols": ["expr_unary_add"] },
            { "name": "expr_unary_add$macrocall$4", "symbols": ["expr_array_index"] },
            { "name": "expr_unary_add$macrocall$1$subexpression$1", "symbols": ["expr_unary_add$macrocall$3"] },
            { "name": "expr_unary_add$macrocall$1$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_unary_add$macrocall$1", "symbols": ["expr_unary_add$macrocall$2", "expr_unary_add$macrocall$1$subexpression$1"], "postprocess": x => lexer_2.track(x, {
                    type: 'unary',
                    ...unwrap(x[0]),
                    operand: unwrap(x[1]),
                }) },
            { "name": "expr_unary_add$macrocall$1", "symbols": ["expr_unary_add$macrocall$4"], "postprocess": unwrap },
            { "name": "expr_unary_add", "symbols": ["expr_unary_add$macrocall$1"] },
            { "name": "expr_array_index$subexpression$1", "symbols": ["expr_array_index"] },
            { "name": "expr_array_index$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_array_index", "symbols": ["expr_array_index$subexpression$1", (lexer_1.lexerAny.has("lbracket") ? { type: "lbracket" } : lbracket), "expr_nostar", (lexer_1.lexerAny.has("rbracket") ? { type: "rbracket" } : rbracket)], "postprocess": x => lexer_2.track(x, {
                    type: 'arrayIndex',
                    array: unwrap(x[0]),
                    index: unwrap(x[2]),
                }) },
            { "name": "expr_array_index", "symbols": ["expr_member"], "postprocess": unwrap },
            { "name": "expr_member$subexpression$1", "symbols": ["expr_member"] },
            { "name": "expr_member$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "expr_member$subexpression$2", "symbols": ["string"] },
            { "name": "expr_member$subexpression$2", "symbols": ["int"] },
            { "name": "expr_member", "symbols": ["expr_member$subexpression$1", "ops_member", "expr_member$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'member',
                    operand: unwrap(x[0]),
                    op: x[1],
                    member: unwrap(x[2])
                }) },
            { "name": "expr_member$subexpression$3", "symbols": ["expr_member"] },
            { "name": "expr_member$subexpression$3", "symbols": ["expr_paren"] },
            { "name": "expr_member", "symbols": ["expr_member$subexpression$3", (lexer_1.lexerAny.has("op_cast") ? { type: "op_cast" } : op_cast), "data_type"], "postprocess": x => lexer_2.track(x, {
                    type: 'cast',
                    operand: unwrap(x[0]),
                    to: x[2],
                }) },
            { "name": "expr_member", "symbols": [(lexer_1.lexerAny.has("kw_cast") ? { type: "kw_cast" } : kw_cast), "lparen", "expr_nostar", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "data_type", "rparen"], "postprocess": x => lexer_2.track(x, {
                    type: 'cast',
                    operand: unwrap(x[2]),
                    to: x[4],
                }) },
            { "name": "expr_member", "symbols": ["data_type", "string"], "postprocess": x => lexer_2.track(x, {
                    type: 'cast',
                    operand: lexer_2.track(x[1], {
                        type: 'string',
                        value: lexer_2.unbox(x[1]),
                    }),
                    to: lexer_2.unbox(x[0]),
                }) },
            { "name": "expr_member", "symbols": ["expr_dot"], "postprocess": unwrap },
            { "name": "expr_dot$subexpression$1", "symbols": ["word"] },
            { "name": "expr_dot$subexpression$1", "symbols": ["star"] },
            { "name": "expr_dot", "symbols": ["qname", (lexer_1.lexerAny.has("dot") ? { type: "dot" } : dot), "expr_dot$subexpression$1"], "postprocess": x => lexer_2.track(x, {
                    type: 'ref',
                    table: unwrap(x[0]),
                    name: toStr(x[2])
                }) },
            { "name": "expr_dot", "symbols": ["expr_final"], "postprocess": unwrap },
            { "name": "expr_final", "symbols": ["expr_basic"] },
            { "name": "expr_final", "symbols": ["expr_primary"] },
            { "name": "expr_basic", "symbols": ["expr_special_calls"] },
            { "name": "expr_basic", "symbols": ["expr_call"] },
            { "name": "expr_basic", "symbols": ["expr_array"] },
            { "name": "expr_basic", "symbols": ["expr_case"] },
            { "name": "expr_basic", "symbols": ["expr_extract"] },
            { "name": "expr_basic", "symbols": ["word"], "postprocess": x => lexer_2.track(x, {
                    type: 'ref',
                    name: unwrap(x[0]),
                }) },
            { "name": "expr_array$ebnf$1", "symbols": ["expr_subarray_items"], "postprocess": id },
            { "name": "expr_array$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_array", "symbols": [(lexer_1.lexerAny.has("kw_array") ? { type: "kw_array" } : kw_array), (lexer_1.lexerAny.has("lbracket") ? { type: "lbracket" } : lbracket), "expr_array$ebnf$1", (lexer_1.lexerAny.has("rbracket") ? { type: "rbracket" } : rbracket)], "postprocess": x => lexer_2.track(x, {
                    type: 'array',
                    expressions: x[2] || [],
                }) },
            { "name": "expr_array", "symbols": [(lexer_1.lexerAny.has("kw_array") ? { type: "kw_array" } : kw_array), "lparen", "selection", "rparen"], "postprocess": x => lexer_2.track(x, {
                    type: 'array select',
                    select: unwrap(x[2]),
                }) },
            { "name": "expr_subarray$ebnf$1", "symbols": ["expr_subarray_items"], "postprocess": id },
            { "name": "expr_subarray$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_subarray", "symbols": [(lexer_1.lexerAny.has("lbracket") ? { type: "lbracket" } : lbracket), "expr_subarray$ebnf$1", (lexer_1.lexerAny.has("rbracket") ? { type: "rbracket" } : rbracket)], "postprocess": get(1) },
            { "name": "expr_subarray_items$macrocall$2", "symbols": ["expr_list_item"] },
            { "name": "expr_subarray_items$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "expr_subarray_items$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "expr_subarray_items$macrocall$2"], "postprocess": last },
            { "name": "expr_subarray_items$macrocall$1$ebnf$1", "symbols": ["expr_subarray_items$macrocall$1$ebnf$1", "expr_subarray_items$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "expr_subarray_items$macrocall$1", "symbols": ["expr_subarray_items$macrocall$2", "expr_subarray_items$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "expr_subarray_items", "symbols": ["expr_subarray_items$macrocall$1"], "postprocess": x => x[0].map(unwrap) },
            { "name": "expr_subarray_items$macrocall$4", "symbols": ["expr_subarray"] },
            { "name": "expr_subarray_items$macrocall$3$ebnf$1", "symbols": [] },
            { "name": "expr_subarray_items$macrocall$3$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "expr_subarray_items$macrocall$4"], "postprocess": last },
            { "name": "expr_subarray_items$macrocall$3$ebnf$1", "symbols": ["expr_subarray_items$macrocall$3$ebnf$1", "expr_subarray_items$macrocall$3$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "expr_subarray_items$macrocall$3", "symbols": ["expr_subarray_items$macrocall$4", "expr_subarray_items$macrocall$3$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "expr_subarray_items", "symbols": ["expr_subarray_items$macrocall$3"], "postprocess": (x) => {
                    return x[0].map((v) => {
                        return lexer_2.track(v, {
                            type: 'array',
                            expressions: v[0].map(unwrap),
                        });
                    });
                } },
            { "name": "expr_call$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_all") ? { type: "kw_all" } : kw_all)] },
            { "name": "expr_call$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_distinct") ? { type: "kw_distinct" } : kw_distinct)] },
            { "name": "expr_call$ebnf$1", "symbols": ["expr_call$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "expr_call$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_call$ebnf$2", "symbols": ["expr_list_raw"], "postprocess": id },
            { "name": "expr_call$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "expr_call$ebnf$3", "symbols": ["select_order_by"], "postprocess": id },
            { "name": "expr_call$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "expr_call$ebnf$4$subexpression$1", "symbols": ["kw_filter", "lparen", (lexer_1.lexerAny.has("kw_where") ? { type: "kw_where" } : kw_where), "expr", "rparen"], "postprocess": get(3) },
            { "name": "expr_call$ebnf$4", "symbols": ["expr_call$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "expr_call$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "expr_call$ebnf$5", "symbols": ["expr_call_over"], "postprocess": id },
            { "name": "expr_call$ebnf$5", "symbols": [], "postprocess": () => null },
            { "name": "expr_call", "symbols": ["expr_fn_name", "lparen", "expr_call$ebnf$1", "expr_call$ebnf$2", "expr_call$ebnf$3", "rparen", "expr_call$ebnf$4", "expr_call$ebnf$5"], "postprocess": x => lexer_2.track(x, {
                    type: 'call',
                    function: unwrap(x[0]),
                    ...x[2] && { distinct: toStr(x[2]) },
                    args: x[3] || [],
                    ...x[4] && { orderBy: x[4] },
                    ...x[6] && { filter: unwrap(x[6]) },
                    ...x[7] && { over: unwrap(x[7]) },
                }) },
            { "name": "expr_call_over$ebnf$1$subexpression$1", "symbols": ["kw_partition", "kw_by", "expr_list_raw"], "postprocess": last },
            { "name": "expr_call_over$ebnf$1", "symbols": ["expr_call_over$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "expr_call_over$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_call_over$ebnf$2", "symbols": ["select_order_by"], "postprocess": id },
            { "name": "expr_call_over$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "expr_call_over", "symbols": ["kw_over", "lparen", "expr_call_over$ebnf$1", "expr_call_over$ebnf$2", "rparen"], "postprocess": x => lexer_2.track(x, {
                    ...x[2] && { partitionBy: x[2] },
                    ...x[3] && { orderBy: x[3] },
                }) },
            { "name": "expr_extract$subexpression$1", "symbols": ["word"], "postprocess": kw('extract') },
            { "name": "expr_extract", "symbols": ["expr_extract$subexpression$1", "lparen", "word", (lexer_1.lexerAny.has("kw_from") ? { type: "kw_from" } : kw_from), "expr", "rparen"], "postprocess": x => lexer_2.track(x, {
                    type: 'extract',
                    field: asName(x[2]),
                    from: x[4],
                }) },
            { "name": "expr_primary", "symbols": ["float"], "postprocess": x => lexer_2.track(x, { type: 'numeric', value: lexer_2.unbox(x[0]) }) },
            { "name": "expr_primary", "symbols": ["int"], "postprocess": x => lexer_2.track(x, { type: 'integer', value: lexer_2.unbox(x[0]) }) },
            { "name": "expr_primary", "symbols": ["string"], "postprocess": x => lexer_2.track(x, { type: 'string', value: lexer_2.unbox(x[0]) }) },
            { "name": "expr_primary", "symbols": [(lexer_1.lexerAny.has("kw_true") ? { type: "kw_true" } : kw_true)], "postprocess": x => lexer_2.track(x, { type: 'boolean', value: true }) },
            { "name": "expr_primary", "symbols": [(lexer_1.lexerAny.has("kw_false") ? { type: "kw_false" } : kw_false)], "postprocess": x => lexer_2.track(x, { type: 'boolean', value: false }) },
            { "name": "expr_primary", "symbols": [(lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null)], "postprocess": x => lexer_2.track(x, { type: 'null' }) },
            { "name": "expr_primary", "symbols": ["value_keyword"], "postprocess": x => lexer_2.track(x, { type: 'keyword', keyword: toStr(x) }) },
            { "name": "expr_primary", "symbols": [(lexer_1.lexerAny.has("qparam") ? { type: "qparam" } : qparam)], "postprocess": x => lexer_2.track(x, { type: 'parameter', name: toStr(x[0]) }) },
            { "name": "expr_primary", "symbols": [(lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)], "postprocess": x => lexer_2.track(x, { type: 'default' }) },
            { "name": "ops_like", "symbols": ["ops_like_keywors"] },
            { "name": "ops_like", "symbols": ["ops_like_operators"] },
            { "name": "ops_like_keywors$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)], "postprocess": id },
            { "name": "ops_like_keywors$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "ops_like_keywors$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_like") ? { type: "kw_like" } : kw_like)] },
            { "name": "ops_like_keywors$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_ilike") ? { type: "kw_ilike" } : kw_ilike)] },
            { "name": "ops_like_keywors", "symbols": ["ops_like_keywors$ebnf$1", "ops_like_keywors$subexpression$1"] },
            { "name": "ops_like_operators$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_like") ? { type: "op_like" } : op_like)], "postprocess": () => 'LIKE' },
            { "name": "ops_like_operators", "symbols": ["ops_like_operators$subexpression$1"] },
            { "name": "ops_like_operators$subexpression$2", "symbols": [(lexer_1.lexerAny.has("op_ilike") ? { type: "op_ilike" } : op_ilike)], "postprocess": () => 'ILIKE' },
            { "name": "ops_like_operators", "symbols": ["ops_like_operators$subexpression$2"] },
            { "name": "ops_like_operators$subexpression$3", "symbols": [(lexer_1.lexerAny.has("op_not_like") ? { type: "op_not_like" } : op_not_like)], "postprocess": () => 'NOT LIKE' },
            { "name": "ops_like_operators", "symbols": ["ops_like_operators$subexpression$3"] },
            { "name": "ops_like_operators$subexpression$4", "symbols": [(lexer_1.lexerAny.has("op_not_ilike") ? { type: "op_not_ilike" } : op_not_ilike)], "postprocess": () => 'NOT ILIKE' },
            { "name": "ops_like_operators", "symbols": ["ops_like_operators$subexpression$4"] },
            { "name": "ops_in$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)], "postprocess": id },
            { "name": "ops_in$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "ops_in", "symbols": ["ops_in$ebnf$1", (lexer_1.lexerAny.has("kw_in") ? { type: "kw_in" } : kw_in)] },
            { "name": "ops_between$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)], "postprocess": id },
            { "name": "ops_between$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "ops_between", "symbols": ["ops_between$ebnf$1", "kw_between"] },
            { "name": "ops_member$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_member") ? { type: "op_member" } : op_member)] },
            { "name": "ops_member$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_membertext") ? { type: "op_membertext" } : op_membertext)] },
            { "name": "ops_member", "symbols": ["ops_member$subexpression$1"], "postprocess": x => { var _a; return (_a = unwrap(x)) === null || _a === void 0 ? void 0 : _a.value; } },
            { "name": "expr_list_item", "symbols": ["expr_or_select"], "postprocess": unwrap },
            { "name": "expr_list_item", "symbols": ["expr_star"], "postprocess": unwrap },
            { "name": "expr_list_raw$macrocall$2", "symbols": ["expr_list_item"] },
            { "name": "expr_list_raw$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "expr_list_raw$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "expr_list_raw$macrocall$2"], "postprocess": last },
            { "name": "expr_list_raw$macrocall$1$ebnf$1", "symbols": ["expr_list_raw$macrocall$1$ebnf$1", "expr_list_raw$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "expr_list_raw$macrocall$1", "symbols": ["expr_list_raw$macrocall$2", "expr_list_raw$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "expr_list_raw", "symbols": ["expr_list_raw$macrocall$1"], "postprocess": ([x]) => x.map(unwrap) },
            { "name": "expr_list_raw_many$macrocall$2", "symbols": ["expr_list_item"] },
            { "name": "expr_list_raw_many$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "expr_list_raw_many$macrocall$2"], "postprocess": last },
            { "name": "expr_list_raw_many$macrocall$1$ebnf$1", "symbols": ["expr_list_raw_many$macrocall$1$ebnf$1$subexpression$1"] },
            { "name": "expr_list_raw_many$macrocall$1$ebnf$1$subexpression$2", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "expr_list_raw_many$macrocall$2"], "postprocess": last },
            { "name": "expr_list_raw_many$macrocall$1$ebnf$1", "symbols": ["expr_list_raw_many$macrocall$1$ebnf$1", "expr_list_raw_many$macrocall$1$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "expr_list_raw_many$macrocall$1", "symbols": ["expr_list_raw_many$macrocall$2", "expr_list_raw_many$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "expr_list_raw_many", "symbols": ["expr_list_raw_many$macrocall$1"], "postprocess": ([x]) => x.map(unwrap) },
            { "name": "expr_or_select", "symbols": ["expr_nostar"], "postprocess": unwrap },
            { "name": "expr_or_select", "symbols": ["selection"], "postprocess": unwrap },
            { "name": "expr_list_many", "symbols": ["expr_list_raw_many"], "postprocess": x => lexer_2.track(x, {
                    type: 'list',
                    expressions: x[0],
                }) },
            { "name": "expr_case$ebnf$1", "symbols": ["expr_nostar"], "postprocess": id },
            { "name": "expr_case$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_case$ebnf$2", "symbols": [] },
            { "name": "expr_case$ebnf$2", "symbols": ["expr_case$ebnf$2", "expr_case_whens"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "expr_case$ebnf$3", "symbols": ["expr_case_else"], "postprocess": id },
            { "name": "expr_case$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "expr_case", "symbols": [(lexer_1.lexerAny.has("kw_case") ? { type: "kw_case" } : kw_case), "expr_case$ebnf$1", "expr_case$ebnf$2", "expr_case$ebnf$3", (lexer_1.lexerAny.has("kw_end") ? { type: "kw_end" } : kw_end)], "postprocess": x => lexer_2.track(x, {
                    type: 'case',
                    value: x[1],
                    whens: x[2],
                    else: x[3],
                }) },
            { "name": "expr_case_whens", "symbols": [(lexer_1.lexerAny.has("kw_when") ? { type: "kw_when" } : kw_when), "expr_nostar", (lexer_1.lexerAny.has("kw_then") ? { type: "kw_then" } : kw_then), "expr_nostar"], "postprocess": x => lexer_2.track(x, {
                    when: x[1],
                    value: x[3],
                }) },
            { "name": "expr_case_else", "symbols": [(lexer_1.lexerAny.has("kw_else") ? { type: "kw_else" } : kw_else), "expr_nostar"], "postprocess": last },
            { "name": "expr_fn_name$subexpression$1$ebnf$1$subexpression$1", "symbols": ["word", (lexer_1.lexerAny.has("dot") ? { type: "dot" } : dot)] },
            { "name": "expr_fn_name$subexpression$1$ebnf$1", "symbols": ["expr_fn_name$subexpression$1$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "expr_fn_name$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "expr_fn_name$subexpression$1", "symbols": ["expr_fn_name$subexpression$1$ebnf$1", "word_or_keyword"], "postprocess": x => lexer_2.track(x, {
                    name: lexer_2.unbox(unwrap(x[1])),
                    ...x[0] && { schema: toStr(x[0][0]) },
                }) },
            { "name": "expr_fn_name", "symbols": ["expr_fn_name$subexpression$1"] },
            { "name": "expr_fn_name$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_any") ? { type: "kw_any" } : kw_any)], "postprocess": x => lexer_2.track(x, {
                    name: 'any',
                }) },
            { "name": "expr_fn_name", "symbols": ["expr_fn_name$subexpression$2"] },
            { "name": "word_or_keyword", "symbols": ["word"] },
            { "name": "word_or_keyword", "symbols": ["value_keyword"], "postprocess": x => lexer_2.box(x, toStr(x)) },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_catalog") ? { type: "kw_current_catalog" } : kw_current_catalog)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_date") ? { type: "kw_current_date" } : kw_current_date)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_role") ? { type: "kw_current_role" } : kw_current_role)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_schema") ? { type: "kw_current_schema" } : kw_current_schema)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_timestamp") ? { type: "kw_current_timestamp" } : kw_current_timestamp)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_time") ? { type: "kw_current_time" } : kw_current_time)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_localtimestamp") ? { type: "kw_localtimestamp" } : kw_localtimestamp)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_localtime") ? { type: "kw_localtime" } : kw_localtime)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_session_user") ? { type: "kw_session_user" } : kw_session_user)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_user") ? { type: "kw_user" } : kw_user)] },
            { "name": "value_keyword", "symbols": [(lexer_1.lexerAny.has("kw_current_user") ? { type: "kw_current_user" } : kw_current_user)] },
            { "name": "expr_special_calls", "symbols": ["spe_overlay"] },
            { "name": "expr_special_calls", "symbols": ["spe_substring"] },
            { "name": "spe_overlay$subexpression$1", "symbols": ["word"], "postprocess": kw('overlay') },
            { "name": "spe_overlay$subexpression$2", "symbols": [(lexer_1.lexerAny.has("lparen") ? { type: "lparen" } : lparen), "expr_nostar"] },
            { "name": "spe_overlay$subexpression$3", "symbols": [(lexer_1.lexerAny.has("kw_placing") ? { type: "kw_placing" } : kw_placing), "expr_nostar"] },
            { "name": "spe_overlay$subexpression$4", "symbols": [(lexer_1.lexerAny.has("kw_from") ? { type: "kw_from" } : kw_from), "expr_nostar"] },
            { "name": "spe_overlay$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_for") ? { type: "kw_for" } : kw_for), "expr_nostar"] },
            { "name": "spe_overlay$ebnf$1", "symbols": ["spe_overlay$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "spe_overlay$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "spe_overlay", "symbols": ["spe_overlay$subexpression$1", "spe_overlay$subexpression$2", "spe_overlay$subexpression$3", "spe_overlay$subexpression$4", "spe_overlay$ebnf$1", (lexer_1.lexerAny.has("rparen") ? { type: "rparen" } : rparen)], "postprocess": x => lexer_2.track(x, {
                    type: 'overlay',
                    value: x[1][1],
                    placing: x[2][1],
                    from: x[3][1],
                    ...x[4] && { for: x[4][1] },
                }) },
            { "name": "spe_substring$subexpression$1", "symbols": ["word"], "postprocess": kw('substring') },
            { "name": "spe_substring$subexpression$2", "symbols": [(lexer_1.lexerAny.has("lparen") ? { type: "lparen" } : lparen), "expr_nostar"] },
            { "name": "spe_substring$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_from") ? { type: "kw_from" } : kw_from), "expr_nostar"] },
            { "name": "spe_substring$ebnf$1", "symbols": ["spe_substring$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "spe_substring$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "spe_substring$ebnf$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_for") ? { type: "kw_for" } : kw_for), "expr_nostar"] },
            { "name": "spe_substring$ebnf$2", "symbols": ["spe_substring$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "spe_substring$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "spe_substring", "symbols": ["spe_substring$subexpression$1", "spe_substring$subexpression$2", "spe_substring$ebnf$1", "spe_substring$ebnf$2", (lexer_1.lexerAny.has("rparen") ? { type: "rparen" } : rparen)], "postprocess": x => lexer_2.track(x, {
                    type: 'substring',
                    value: x[1][1],
                    ...x[2] && { from: x[2][1] },
                    ...x[3] && { for: x[3][1] },
                }) },
            { "name": "createtable_statement$ebnf$1", "symbols": ["createtable_modifiers"], "postprocess": id },
            { "name": "createtable_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createtable_statement$ebnf$2", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "createtable_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "createtable_statement$ebnf$3", "symbols": ["createtable_opts"], "postprocess": id },
            { "name": "createtable_statement$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "createtable_statement", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "createtable_statement$ebnf$1", (lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table), "createtable_statement$ebnf$2", "qname", "lparen", "createtable_declarationlist", "rparen", "createtable_statement$ebnf$3"], "postprocess": x => {
                    const cols = x[6].filter((v) => 'kind' in v);
                    const constraints = x[6].filter((v) => !('kind' in v));
                    return lexer_2.track(x, {
                        type: 'create table',
                        ...!!x[3] ? { ifNotExists: true } : {},
                        name: x[4],
                        columns: cols,
                        ...unwrap(x[1]),
                        ...constraints.length ? { constraints } : {},
                        ...last(x),
                    });
                } },
            { "name": "createtable_modifiers", "symbols": ["kw_unlogged"], "postprocess": x => x[0] ? { unlogged: true } : {} },
            { "name": "createtable_modifiers", "symbols": ["m_locglob"] },
            { "name": "createtable_modifiers", "symbols": ["m_tmp"] },
            { "name": "createtable_modifiers", "symbols": ["m_locglob", "m_tmp"], "postprocess": ([a, b]) => ({ ...a, ...b }) },
            { "name": "m_locglob$subexpression$1", "symbols": ["kw_local"] },
            { "name": "m_locglob$subexpression$1", "symbols": ["kw_global"] },
            { "name": "m_locglob", "symbols": ["m_locglob$subexpression$1"], "postprocess": x => ({ locality: toStr(x) }) },
            { "name": "m_tmp$subexpression$1", "symbols": ["kw_temp"] },
            { "name": "m_tmp$subexpression$1", "symbols": ["kw_temporary"] },
            { "name": "m_tmp", "symbols": ["m_tmp$subexpression$1"], "postprocess": x => ({ temporary: true }) },
            { "name": "createtable_declarationlist$ebnf$1", "symbols": [] },
            { "name": "createtable_declarationlist$ebnf$1$subexpression$1", "symbols": ["comma", "createtable_declaration"], "postprocess": last },
            { "name": "createtable_declarationlist$ebnf$1", "symbols": ["createtable_declarationlist$ebnf$1", "createtable_declarationlist$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtable_declarationlist", "symbols": ["createtable_declaration", "createtable_declarationlist$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "createtable_declaration$subexpression$1", "symbols": ["createtable_constraint"] },
            { "name": "createtable_declaration$subexpression$1", "symbols": ["createtable_column"] },
            { "name": "createtable_declaration$subexpression$1", "symbols": ["createtable_like"] },
            { "name": "createtable_declaration", "symbols": ["createtable_declaration$subexpression$1"], "postprocess": unwrap },
            { "name": "createtable_constraint$macrocall$2", "symbols": ["createtable_constraint_def"] },
            { "name": "createtable_constraint$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_constraint") ? { type: "kw_constraint" } : kw_constraint), "word"] },
            { "name": "createtable_constraint$macrocall$1$ebnf$1", "symbols": ["createtable_constraint$macrocall$1$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "createtable_constraint$macrocall$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createtable_constraint$macrocall$1", "symbols": ["createtable_constraint$macrocall$1$ebnf$1", "createtable_constraint$macrocall$2"], "postprocess": x => {
                    const name = x[0] && asName(x[0][1]);
                    if (!name) {
                        return lexer_2.track(x, unwrap(x[1]));
                    }
                    return lexer_2.track(x, {
                        constraintName: name,
                        ...unwrap(x[1]),
                    });
                } },
            { "name": "createtable_constraint", "symbols": ["createtable_constraint$macrocall$1"], "postprocess": unwrap },
            { "name": "createtable_constraint_def", "symbols": ["createtable_constraint_def_unique"] },
            { "name": "createtable_constraint_def", "symbols": ["createtable_constraint_def_check"] },
            { "name": "createtable_constraint_def", "symbols": ["createtable_constraint_foreignkey"] },
            { "name": "createtable_constraint_def_unique$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_unique") ? { type: "kw_unique" } : kw_unique)] },
            { "name": "createtable_constraint_def_unique$subexpression$1", "symbols": ["kw_primary_key"] },
            { "name": "createtable_constraint_def_unique", "symbols": ["createtable_constraint_def_unique$subexpression$1", "lparen", "createtable_collist", "rparen"], "postprocess": x => lexer_2.track(x, {
                    type: toStr(x[0], ' '),
                    columns: x[2].map(asName),
                }) },
            { "name": "createtable_constraint_def_check", "symbols": [(lexer_1.lexerAny.has("kw_check") ? { type: "kw_check" } : kw_check), "expr_paren"], "postprocess": x => lexer_2.track(x, {
                    type: 'check',
                    expr: unwrap(x[1]),
                }) },
            { "name": "createtable_constraint_foreignkey$ebnf$1", "symbols": [] },
            { "name": "createtable_constraint_foreignkey$ebnf$1", "symbols": ["createtable_constraint_foreignkey$ebnf$1", "createtable_constraint_foreignkey_onsometing"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtable_constraint_foreignkey", "symbols": [(lexer_1.lexerAny.has("kw_foreign") ? { type: "kw_foreign" } : kw_foreign), "kw_key", "collist_paren", (lexer_1.lexerAny.has("kw_references") ? { type: "kw_references" } : kw_references), "qualified_name", "collist_paren", "createtable_constraint_foreignkey$ebnf$1"], "postprocess": (x) => {
                    return lexer_2.track(x, {
                        type: 'foreign key',
                        localColumns: x[2].map(asName),
                        foreignTable: unwrap(x[4]),
                        foreignColumns: x[5].map(asName),
                        ...x[6].reduce((a, b) => ({ ...a, ...b }), {}),
                    });
                } },
            { "name": "createtable_constraint_foreignkey_onsometing", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "kw_delete", "createtable_constraint_on_action"], "postprocess": x => lexer_2.track(x, { onDelete: last(x) }) },
            { "name": "createtable_constraint_foreignkey_onsometing", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "kw_update", "createtable_constraint_on_action"], "postprocess": x => lexer_2.track(x, { onUpdate: last(x) }) },
            { "name": "createtable_constraint_foreignkey_onsometing$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_full") ? { type: "kw_full" } : kw_full)] },
            { "name": "createtable_constraint_foreignkey_onsometing$subexpression$1", "symbols": ["kw_partial"] },
            { "name": "createtable_constraint_foreignkey_onsometing$subexpression$1", "symbols": ["kw_simple"] },
            { "name": "createtable_constraint_foreignkey_onsometing", "symbols": ["kw_match", "createtable_constraint_foreignkey_onsometing$subexpression$1"], "postprocess": x => lexer_2.track(x, { match: toStr(last(x)) }) },
            { "name": "createtable_constraint_on_action$subexpression$1", "symbols": ["kw_cascade"] },
            { "name": "createtable_constraint_on_action$subexpression$1$subexpression$1", "symbols": ["kw_no", "kw_action"] },
            { "name": "createtable_constraint_on_action$subexpression$1", "symbols": ["createtable_constraint_on_action$subexpression$1$subexpression$1"] },
            { "name": "createtable_constraint_on_action$subexpression$1", "symbols": ["kw_restrict"] },
            { "name": "createtable_constraint_on_action$subexpression$1$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null)] },
            { "name": "createtable_constraint_on_action$subexpression$1$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)] },
            { "name": "createtable_constraint_on_action$subexpression$1", "symbols": ["kw_set", "createtable_constraint_on_action$subexpression$1$subexpression$2"] },
            { "name": "createtable_constraint_on_action", "symbols": ["createtable_constraint_on_action$subexpression$1"], "postprocess": x => toStr(x, ' ') },
            { "name": "createtable_collist$ebnf$1", "symbols": [] },
            { "name": "createtable_collist$ebnf$1$subexpression$1", "symbols": ["comma", "ident"], "postprocess": last },
            { "name": "createtable_collist$ebnf$1", "symbols": ["createtable_collist$ebnf$1", "createtable_collist$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtable_collist", "symbols": ["ident", "createtable_collist$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "createtable_column$ebnf$1", "symbols": ["createtable_collate"], "postprocess": id },
            { "name": "createtable_column$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createtable_column$ebnf$2", "symbols": [] },
            { "name": "createtable_column$ebnf$2", "symbols": ["createtable_column$ebnf$2", "createtable_column_constraint"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtable_column", "symbols": ["word", "data_type", "createtable_column$ebnf$1", "createtable_column$ebnf$2"], "postprocess": x => {
                    return lexer_2.track(x, {
                        kind: 'column',
                        name: asName(x[0]),
                        dataType: x[1],
                        ...x[2] ? { collate: x[2][1] } : {},
                        ...x[3] && x[3].length ? { constraints: x[3] } : {},
                    });
                } },
            { "name": "createtable_like$ebnf$1", "symbols": [] },
            { "name": "createtable_like$ebnf$1", "symbols": ["createtable_like$ebnf$1", "createtable_like_opt"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtable_like", "symbols": [(lexer_1.lexerAny.has("kw_like") ? { type: "kw_like" } : kw_like), "qname", "createtable_like$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    kind: 'like table',
                    like: x[1],
                    options: x[2],
                }) },
            { "name": "createtable_like_opt$subexpression$1", "symbols": ["kw_including"] },
            { "name": "createtable_like_opt$subexpression$1", "symbols": ["kw_excluding"] },
            { "name": "createtable_like_opt", "symbols": ["createtable_like_opt$subexpression$1", "createtable_like_opt_val"], "postprocess": x => lexer_2.track(x, {
                    verb: toStr(x[0]),
                    option: toStr(x[1]),
                }) },
            { "name": "createtable_like_opt_val", "symbols": ["word"], "postprocess": anyKw('defaults', 'constraints', 'indexes', 'storage', 'comments') },
            { "name": "createtable_like_opt_val", "symbols": [(lexer_1.lexerAny.has("kw_all") ? { type: "kw_all" } : kw_all)] },
            { "name": "createtable_column_constraint$macrocall$2", "symbols": ["createtable_column_constraint_def"] },
            { "name": "createtable_column_constraint$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_constraint") ? { type: "kw_constraint" } : kw_constraint), "word"] },
            { "name": "createtable_column_constraint$macrocall$1$ebnf$1", "symbols": ["createtable_column_constraint$macrocall$1$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "createtable_column_constraint$macrocall$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createtable_column_constraint$macrocall$1", "symbols": ["createtable_column_constraint$macrocall$1$ebnf$1", "createtable_column_constraint$macrocall$2"], "postprocess": x => {
                    const name = x[0] && asName(x[0][1]);
                    if (!name) {
                        return lexer_2.track(x, unwrap(x[1]));
                    }
                    return lexer_2.track(x, {
                        constraintName: name,
                        ...unwrap(x[1]),
                    });
                } },
            { "name": "createtable_column_constraint", "symbols": ["createtable_column_constraint$macrocall$1"], "postprocess": unwrap },
            { "name": "createtable_column_constraint_def", "symbols": [(lexer_1.lexerAny.has("kw_unique") ? { type: "kw_unique" } : kw_unique)], "postprocess": x => lexer_2.track(x, { type: 'unique' }) },
            { "name": "createtable_column_constraint_def", "symbols": ["kw_primary_key"], "postprocess": x => lexer_2.track(x, { type: 'primary key' }) },
            { "name": "createtable_column_constraint_def", "symbols": ["kw_not_null"], "postprocess": x => lexer_2.track(x, { type: 'not null' }) },
            { "name": "createtable_column_constraint_def", "symbols": [(lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null)], "postprocess": x => lexer_2.track(x, { type: 'null' }) },
            { "name": "createtable_column_constraint_def", "symbols": [(lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default), "expr"], "postprocess": x => lexer_2.track(x, { type: 'default', default: unwrap(x[1]) }) },
            { "name": "createtable_column_constraint_def", "symbols": [(lexer_1.lexerAny.has("kw_check") ? { type: "kw_check" } : kw_check), "expr_paren"], "postprocess": x => lexer_2.track(x, { type: 'check', expr: unwrap(x[1]) }) },
            { "name": "createtable_column_constraint_def", "symbols": ["altercol_generated"] },
            { "name": "createtable_collate", "symbols": [(lexer_1.lexerAny.has("kw_collate") ? { type: "kw_collate" } : kw_collate), "qualified_name"] },
            { "name": "createtable_opts$subexpression$1", "symbols": ["word"], "postprocess": kw('inherits') },
            { "name": "createtable_opts$macrocall$2", "symbols": ["qname"] },
            { "name": "createtable_opts$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "createtable_opts$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "createtable_opts$macrocall$2"], "postprocess": last },
            { "name": "createtable_opts$macrocall$1$ebnf$1", "symbols": ["createtable_opts$macrocall$1$ebnf$1", "createtable_opts$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtable_opts$macrocall$1", "symbols": ["createtable_opts$macrocall$2", "createtable_opts$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "createtable_opts", "symbols": ["createtable_opts$subexpression$1", "lparen", "createtable_opts$macrocall$1", "rparen"], "postprocess": x => lexer_2.track(x, { inherits: x[2] }) },
            { "name": "createindex_statement$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_unique") ? { type: "kw_unique" } : kw_unique)], "postprocess": id },
            { "name": "createindex_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createindex_statement$ebnf$2", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "createindex_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "createindex_statement$ebnf$3", "symbols": ["word"], "postprocess": id },
            { "name": "createindex_statement$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "createindex_statement$ebnf$4$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_using") ? { type: "kw_using" } : kw_using), "ident"], "postprocess": last },
            { "name": "createindex_statement$ebnf$4", "symbols": ["createindex_statement$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "createindex_statement$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "createindex_statement", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "createindex_statement$ebnf$1", "kw_index", "createindex_statement$ebnf$2", "createindex_statement$ebnf$3", (lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "table_ref", "createindex_statement$ebnf$4", "lparen", "createindex_expressions", "rparen"], "postprocess": x => lexer_2.track(x, {
                    type: 'create index',
                    ...x[1] && { unique: true },
                    ...x[3] && { ifNotExists: true },
                    ...x[4] && { indexName: asName(x[4]) },
                    table: x[6],
                    ...x[7] && { using: asName(x[7]) },
                    expressions: x[9],
                }) },
            { "name": "createindex_expressions$ebnf$1", "symbols": [] },
            { "name": "createindex_expressions$ebnf$1$subexpression$1", "symbols": ["comma", "createindex_expression"], "postprocess": last },
            { "name": "createindex_expressions$ebnf$1", "symbols": ["createindex_expressions$ebnf$1", "createindex_expressions$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createindex_expressions", "symbols": ["createindex_expression", "createindex_expressions$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "createindex_expression$subexpression$1", "symbols": ["expr_basic"] },
            { "name": "createindex_expression$subexpression$1", "symbols": ["expr_paren"] },
            { "name": "createindex_expression$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_collate") ? { type: "kw_collate" } : kw_collate), "qualified_name"], "postprocess": last },
            { "name": "createindex_expression$ebnf$1", "symbols": ["createindex_expression$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "createindex_expression$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createindex_expression$ebnf$2", "symbols": ["qualified_name"], "postprocess": id },
            { "name": "createindex_expression$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "createindex_expression$ebnf$3$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_asc") ? { type: "kw_asc" } : kw_asc)] },
            { "name": "createindex_expression$ebnf$3$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_desc") ? { type: "kw_desc" } : kw_desc)] },
            { "name": "createindex_expression$ebnf$3", "symbols": ["createindex_expression$ebnf$3$subexpression$1"], "postprocess": id },
            { "name": "createindex_expression$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "createindex_expression$ebnf$4$subexpression$1$subexpression$1", "symbols": ["kw_first"] },
            { "name": "createindex_expression$ebnf$4$subexpression$1$subexpression$1", "symbols": ["kw_last"] },
            { "name": "createindex_expression$ebnf$4$subexpression$1", "symbols": ["kw_nulls", "createindex_expression$ebnf$4$subexpression$1$subexpression$1"], "postprocess": last },
            { "name": "createindex_expression$ebnf$4", "symbols": ["createindex_expression$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "createindex_expression$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "createindex_expression", "symbols": ["createindex_expression$subexpression$1", "createindex_expression$ebnf$1", "createindex_expression$ebnf$2", "createindex_expression$ebnf$3", "createindex_expression$ebnf$4"], "postprocess": x => lexer_2.track(x, {
                    expression: unwrap(x[0]),
                    ...x[1] && { collate: unwrap(x[1]) },
                    ...x[2] && { opclass: unwrap(x[2]) },
                    ...x[3] && { order: unwrap(x[3]).value },
                    ...x[4] && { nulls: unwrap(x[4]) },
                }) },
            { "name": "createextension_statement$ebnf$1", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "createextension_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "createextension_statement$ebnf$2", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with)], "postprocess": id },
            { "name": "createextension_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "createextension_statement$ebnf$3$subexpression$1", "symbols": ["kw_schema", "word"], "postprocess": last },
            { "name": "createextension_statement$ebnf$3", "symbols": ["createextension_statement$ebnf$3$subexpression$1"], "postprocess": id },
            { "name": "createextension_statement$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "createextension_statement$ebnf$4$subexpression$1", "symbols": ["kw_version", "string"], "postprocess": last },
            { "name": "createextension_statement$ebnf$4", "symbols": ["createextension_statement$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "createextension_statement$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "createextension_statement$ebnf$5$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_from") ? { type: "kw_from" } : kw_from), "string"], "postprocess": last },
            { "name": "createextension_statement$ebnf$5", "symbols": ["createextension_statement$ebnf$5$subexpression$1"], "postprocess": id },
            { "name": "createextension_statement$ebnf$5", "symbols": [], "postprocess": () => null },
            { "name": "createextension_statement", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "kw_extension", "createextension_statement$ebnf$1", "word", "createextension_statement$ebnf$2", "createextension_statement$ebnf$3", "createextension_statement$ebnf$4", "createextension_statement$ebnf$5"], "postprocess": x => lexer_2.track(x, {
                    type: 'create extension',
                    ...!!x[2] ? { ifNotExists: true } : {},
                    extension: asName(x[3]),
                    ...!!x[5] ? { schema: asName(x[5]) } : {},
                    ...!!x[6] ? { version: asLit(x[6]) } : {},
                    ...!!x[7] ? { from: asLit(x[7]) } : {},
                }) },
            { "name": "simplestatements_all", "symbols": ["simplestatements_start_transaction"] },
            { "name": "simplestatements_all", "symbols": ["simplestatements_commit"] },
            { "name": "simplestatements_all", "symbols": ["simplestatements_rollback"] },
            { "name": "simplestatements_all", "symbols": ["simplestatements_tablespace"] },
            { "name": "simplestatements_all", "symbols": ["simplestatements_set"] },
            { "name": "simplestatements_all", "symbols": ["simplestatements_show"] },
            { "name": "simplestatements_all", "symbols": ["simplestatements_begin"] },
            { "name": "simplestatements_start_transaction$subexpression$1", "symbols": ["kw_start", "kw_transaction"] },
            { "name": "simplestatements_start_transaction", "symbols": ["simplestatements_start_transaction$subexpression$1"], "postprocess": x => lexer_2.track(x, { type: 'start transaction' }) },
            { "name": "simplestatements_commit", "symbols": ["kw_commit"], "postprocess": x => lexer_2.track(x, { type: 'commit' }) },
            { "name": "simplestatements_rollback", "symbols": ["kw_rollback"], "postprocess": x => lexer_2.track(x, { type: 'rollback' }) },
            { "name": "simplestatements_tablespace", "symbols": ["kw_tablespace", "word"], "postprocess": x => lexer_2.track(x, {
                    type: 'tablespace',
                    tablespace: asName(x[1]),
                }) },
            { "name": "simplestatements_set$subexpression$1", "symbols": ["simplestatements_set_simple"] },
            { "name": "simplestatements_set$subexpression$1", "symbols": ["simplestatements_set_timezone"] },
            { "name": "simplestatements_set", "symbols": ["kw_set", "simplestatements_set$subexpression$1"], "postprocess": last },
            { "name": "simplestatements_set_timezone", "symbols": ["kw_time", "kw_zone", "simplestatements_set_timezone_val"], "postprocess": x => lexer_2.track(x, { type: 'set timezone', to: x[2] }) },
            { "name": "simplestatements_set_timezone_val$subexpression$1", "symbols": ["string"] },
            { "name": "simplestatements_set_timezone_val$subexpression$1", "symbols": ["int"] },
            { "name": "simplestatements_set_timezone_val", "symbols": ["simplestatements_set_timezone_val$subexpression$1"], "postprocess": x => lexer_2.track(x, { type: 'value', value: unwrap(x[0]) }) },
            { "name": "simplestatements_set_timezone_val", "symbols": ["kw_local"], "postprocess": x => lexer_2.track(x, { type: 'local' }) },
            { "name": "simplestatements_set_timezone_val", "symbols": [(lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)], "postprocess": x => lexer_2.track(x, { type: 'default' }) },
            { "name": "simplestatements_set_timezone_val", "symbols": ["kw_interval", "string", "kw_hour", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "kw_minute"], "postprocess": x => lexer_2.track(x, { type: 'interval', value: lexer_2.unbox(x[1]) }) },
            { "name": "simplestatements_set_simple$subexpression$1", "symbols": [(lexer_1.lexerAny.has("op_eq") ? { type: "op_eq" } : op_eq)] },
            { "name": "simplestatements_set_simple$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to)] },
            { "name": "simplestatements_set_simple", "symbols": ["ident", "simplestatements_set_simple$subexpression$1", "simplestatements_set_val"], "postprocess": x => lexer_2.track(x, {
                    type: 'set',
                    variable: asName(x[0]),
                    set: lexer_2.unbox(x[2]),
                }) },
            { "name": "simplestatements_set_val", "symbols": ["simplestatements_set_val_raw"], "postprocess": unwrap },
            { "name": "simplestatements_set_val", "symbols": [(lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)], "postprocess": x => lexer_2.track(x, { type: 'default' }) },
            { "name": "simplestatements_set_val$ebnf$1$subexpression$1", "symbols": ["comma", "simplestatements_set_val_raw"] },
            { "name": "simplestatements_set_val$ebnf$1", "symbols": ["simplestatements_set_val$ebnf$1$subexpression$1"] },
            { "name": "simplestatements_set_val$ebnf$1$subexpression$2", "symbols": ["comma", "simplestatements_set_val_raw"] },
            { "name": "simplestatements_set_val$ebnf$1", "symbols": ["simplestatements_set_val$ebnf$1", "simplestatements_set_val$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "simplestatements_set_val", "symbols": ["simplestatements_set_val_raw", "simplestatements_set_val$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    type: 'list',
                    values: [x[0], ...(x[1] || [])]
                }) },
            { "name": "simplestatements_set_val_raw$subexpression$1", "symbols": ["string"] },
            { "name": "simplestatements_set_val_raw$subexpression$1", "symbols": ["int"] },
            { "name": "simplestatements_set_val_raw", "symbols": ["simplestatements_set_val_raw$subexpression$1"], "postprocess": x => lexer_2.track(x, { type: 'value', value: unwrap(x) }) },
            { "name": "simplestatements_set_val_raw$subexpression$2", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)] },
            { "name": "simplestatements_set_val_raw$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on)] },
            { "name": "simplestatements_set_val_raw$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_true") ? { type: "kw_true" } : kw_true)] },
            { "name": "simplestatements_set_val_raw$subexpression$2", "symbols": [(lexer_1.lexerAny.has("kw_false") ? { type: "kw_false" } : kw_false)] },
            { "name": "simplestatements_set_val_raw", "symbols": ["simplestatements_set_val_raw$subexpression$2"], "postprocess": x => lexer_2.track(x, { type: 'identifier', name: unwrap(x).value }) },
            { "name": "simplestatements_show", "symbols": ["kw_show", "ident"], "postprocess": x => lexer_2.track(x, { type: 'show', variable: asName(x[1]) }) },
            { "name": "create_schema$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "kw_schema"] },
            { "name": "create_schema$ebnf$1", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "create_schema$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_schema", "symbols": ["create_schema$subexpression$1", "create_schema$ebnf$1", "ident"], "postprocess": x => lexer_2.track(x, {
                    type: 'create schema',
                    name: asName(x[2]),
                    ...!!x[1] ? { ifNotExists: true } : {},
                }) },
            { "name": "raise_statement$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": anyKw('debug', 'log', 'info', 'notice', 'warning', 'exception') },
            { "name": "raise_statement$ebnf$1", "symbols": ["raise_statement$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "raise_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "raise_statement$ebnf$2$subexpression$1", "symbols": ["comma", "expr_list_raw"], "postprocess": last },
            { "name": "raise_statement$ebnf$2", "symbols": ["raise_statement$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "raise_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "raise_statement$ebnf$3", "symbols": ["raise_using"], "postprocess": id },
            { "name": "raise_statement$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "raise_statement", "symbols": ["kw_raise", "raise_statement$ebnf$1", "string", "raise_statement$ebnf$2", "raise_statement$ebnf$3"], "postprocess": x => lexer_2.track(x, {
                    type: 'raise',
                    format: toStr(x[2]),
                    ...x[1] && { level: toStr(x[1]) },
                    ...x[3] && x[3].length && { formatExprs: x[3] },
                    ...x[4] && x[4].length && { using: x[4] },
                }) },
            { "name": "raise_using$macrocall$2", "symbols": ["raise_using_one"] },
            { "name": "raise_using$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "raise_using$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "raise_using$macrocall$2"], "postprocess": last },
            { "name": "raise_using$macrocall$1$ebnf$1", "symbols": ["raise_using$macrocall$1$ebnf$1", "raise_using$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "raise_using$macrocall$1", "symbols": ["raise_using$macrocall$2", "raise_using$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "raise_using", "symbols": [(lexer_1.lexerAny.has("kw_using") ? { type: "kw_using" } : kw_using), "raise_using$macrocall$1"], "postprocess": last },
            { "name": "raise_using_one", "symbols": ["raise_using_what", (lexer_1.lexerAny.has("op_eq") ? { type: "op_eq" } : op_eq), "expr"], "postprocess": x => lexer_2.track(x, {
                    type: toStr(x[0]),
                    value: x[2],
                }) },
            { "name": "raise_using_what", "symbols": [(lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table)] },
            { "name": "raise_using_what", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": anyKw('message', 'detail', 'hint', 'errcode', 'column', 'constraint', 'datatype', 'schema') },
            { "name": "comment_statement", "symbols": ["kw_comment", (lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "comment_what", (lexer_1.lexerAny.has("kw_is") ? { type: "kw_is" } : kw_is), "string"], "postprocess": x => lexer_2.track(x, {
                    type: 'comment',
                    comment: lexer_2.unbox(last(x)),
                    on: unwrap(x[2]),
                }) },
            { "name": "comment_what", "symbols": ["comment_what_col"] },
            { "name": "comment_what", "symbols": ["comment_what_nm"] },
            { "name": "comment_what_nm$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table)] },
            { "name": "comment_what_nm$subexpression$1", "symbols": ["kw_materialized", "kw_view"] },
            { "name": "comment_what_nm$subexpression$1", "symbols": [(lexer_1.lexerAny.has("word") ? { type: "word" } : word)], "postprocess": anyKw('database', 'index', 'trigger', 'type', 'view') },
            { "name": "comment_what_nm", "symbols": ["comment_what_nm$subexpression$1", "qualified_name"], "postprocess": x => lexer_2.track(x, {
                    type: toStr(x[0]),
                    name: x[1],
                }) },
            { "name": "comment_what_col", "symbols": [(lexer_1.lexerAny.has("kw_column") ? { type: "kw_column" } : kw_column), "qcolumn"], "postprocess": x => lexer_2.track(x, {
                    type: 'column',
                    column: last(x),
                }) },
            { "name": "simplestatements_begin$ebnf$1$subexpression$1", "symbols": ["kw_transaction"] },
            { "name": "simplestatements_begin$ebnf$1$subexpression$1", "symbols": ["kw_work"] },
            { "name": "simplestatements_begin$ebnf$1", "symbols": ["simplestatements_begin$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "simplestatements_begin$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "simplestatements_begin$ebnf$2", "symbols": [] },
            { "name": "simplestatements_begin$ebnf$2$subexpression$1", "symbols": ["simplestatements_begin_isol"] },
            { "name": "simplestatements_begin$ebnf$2$subexpression$1", "symbols": ["simplestatements_begin_writ"] },
            { "name": "simplestatements_begin$ebnf$2$subexpression$1", "symbols": ["simplestatements_begin_def"] },
            { "name": "simplestatements_begin$ebnf$2", "symbols": ["simplestatements_begin$ebnf$2", "simplestatements_begin$ebnf$2$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "simplestatements_begin", "symbols": ["kw_begin", "simplestatements_begin$ebnf$1", "simplestatements_begin$ebnf$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'begin',
                    ...x[2].reduce((a, b) => ({ ...unwrap(a), ...unwrap(b) }), {}),
                })
            },
            { "name": "simplestatements_begin_isol$subexpression$1", "symbols": ["kw_isolation", "kw_level"] },
            { "name": "simplestatements_begin_isol$subexpression$2", "symbols": ["kw_serializable"] },
            { "name": "simplestatements_begin_isol$subexpression$2$subexpression$1", "symbols": ["word"], "postprocess": kw('repeatable') },
            { "name": "simplestatements_begin_isol$subexpression$2", "symbols": ["simplestatements_begin_isol$subexpression$2$subexpression$1", "kw_read"] },
            { "name": "simplestatements_begin_isol$subexpression$2$subexpression$2", "symbols": ["word"], "postprocess": kw('committed') },
            { "name": "simplestatements_begin_isol$subexpression$2", "symbols": ["kw_read", "simplestatements_begin_isol$subexpression$2$subexpression$2"] },
            { "name": "simplestatements_begin_isol$subexpression$2$subexpression$3", "symbols": ["word"], "postprocess": kw('uncommitted') },
            { "name": "simplestatements_begin_isol$subexpression$2", "symbols": ["kw_read", "simplestatements_begin_isol$subexpression$2$subexpression$3"] },
            { "name": "simplestatements_begin_isol", "symbols": ["simplestatements_begin_isol$subexpression$1", "simplestatements_begin_isol$subexpression$2"], "postprocess": x => lexer_2.track(x, {
                    isolationLevel: toStr(x[1], ' '),
                }) },
            { "name": "simplestatements_begin_writ$subexpression$1", "symbols": ["kw_read", "kw_write"] },
            { "name": "simplestatements_begin_writ$subexpression$1", "symbols": ["kw_read", (lexer_1.lexerAny.has("kw_only") ? { type: "kw_only" } : kw_only)] },
            { "name": "simplestatements_begin_writ", "symbols": ["simplestatements_begin_writ$subexpression$1"], "postprocess": x => lexer_2.track(x, {
                    writeable: toStr(x, ' '),
                }) },
            { "name": "simplestatements_begin_def$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)], "postprocess": id },
            { "name": "simplestatements_begin_def$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "simplestatements_begin_def", "symbols": ["simplestatements_begin_def$ebnf$1", (lexer_1.lexerAny.has("kw_deferrable") ? { type: "kw_deferrable" } : kw_deferrable)], "postprocess": x => lexer_2.track(x, {
                    deferrable: !x[0]
                }) },
            { "name": "insert_statement$subexpression$1", "symbols": ["kw_insert", (lexer_1.lexerAny.has("kw_into") ? { type: "kw_into" } : kw_into)] },
            { "name": "insert_statement$ebnf$1", "symbols": ["collist_paren"], "postprocess": id },
            { "name": "insert_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "insert_statement$ebnf$2$subexpression$1$subexpression$1", "symbols": ["kw_system"] },
            { "name": "insert_statement$ebnf$2$subexpression$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_user") ? { type: "kw_user" } : kw_user)] },
            { "name": "insert_statement$ebnf$2$subexpression$1", "symbols": ["kw_overriding", "insert_statement$ebnf$2$subexpression$1$subexpression$1", "kw_value"], "postprocess": get(1) },
            { "name": "insert_statement$ebnf$2", "symbols": ["insert_statement$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "insert_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "insert_statement$ebnf$3$subexpression$1", "symbols": ["selection"] },
            { "name": "insert_statement$ebnf$3$subexpression$1", "symbols": ["selection_paren"] },
            { "name": "insert_statement$ebnf$3", "symbols": ["insert_statement$ebnf$3$subexpression$1"], "postprocess": id },
            { "name": "insert_statement$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "insert_statement$ebnf$4$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), "kw_conflict", "insert_on_conflict"], "postprocess": last },
            { "name": "insert_statement$ebnf$4", "symbols": ["insert_statement$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "insert_statement$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "insert_statement$ebnf$5$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_returning") ? { type: "kw_returning" } : kw_returning), "select_expr_list_aliased"], "postprocess": last },
            { "name": "insert_statement$ebnf$5", "symbols": ["insert_statement$ebnf$5$subexpression$1"], "postprocess": id },
            { "name": "insert_statement$ebnf$5", "symbols": [], "postprocess": () => null },
            { "name": "insert_statement", "symbols": ["insert_statement$subexpression$1", "table_ref_aliased", "insert_statement$ebnf$1", "insert_statement$ebnf$2", "insert_statement$ebnf$3", "insert_statement$ebnf$4", "insert_statement$ebnf$5"], "postprocess": x => {
                    const columns = x[2] && x[2].map(asName);
                    const overriding = toStr(x[3]);
                    const insert = unwrap(x[4]);
                    const onConflict = x[5];
                    const returning = x[6];
                    return lexer_2.track(x, {
                        type: 'insert',
                        into: unwrap(x[1]),
                        insert,
                        ...overriding && { overriding },
                        ...columns && { columns },
                        ...returning && { returning },
                        ...onConflict && { onConflict },
                    });
                } },
            { "name": "insert_values$ebnf$1", "symbols": [] },
            { "name": "insert_values$ebnf$1$subexpression$1", "symbols": ["comma", "insert_value"], "postprocess": last },
            { "name": "insert_values$ebnf$1", "symbols": ["insert_values$ebnf$1", "insert_values$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "insert_values", "symbols": ["insert_value", "insert_values$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "insert_value", "symbols": ["lparen", "insert_expr_list_raw", "rparen"], "postprocess": get(1) },
            { "name": "insert_expr_list_raw$ebnf$1", "symbols": [] },
            { "name": "insert_expr_list_raw$ebnf$1$subexpression$1", "symbols": ["comma", "expr_or_select"], "postprocess": last },
            { "name": "insert_expr_list_raw$ebnf$1", "symbols": ["insert_expr_list_raw$ebnf$1", "insert_expr_list_raw$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "insert_expr_list_raw", "symbols": ["expr_or_select", "insert_expr_list_raw$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "insert_on_conflict$ebnf$1", "symbols": ["insert_on_conflict_what"], "postprocess": id },
            { "name": "insert_on_conflict$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "insert_on_conflict", "symbols": ["insert_on_conflict$ebnf$1", "insert_on_conflict_do"], "postprocess": x => lexer_2.track(x, {
                    ...x[0] ? { on: x[0][0] } : {},
                    do: lexer_2.unbox(x[1]),
                }) },
            { "name": "insert_on_conflict_what$subexpression$1", "symbols": ["lparen", "expr_list_raw", "rparen"], "postprocess": get(1) },
            { "name": "insert_on_conflict_what", "symbols": ["insert_on_conflict_what$subexpression$1"] },
            { "name": "insert_on_conflict_do", "symbols": [(lexer_1.lexerAny.has("kw_do") ? { type: "kw_do" } : kw_do), "kw_nothing"], "postprocess": x => lexer_2.box(x, 'do nothing') },
            { "name": "insert_on_conflict_do", "symbols": [(lexer_1.lexerAny.has("kw_do") ? { type: "kw_do" } : kw_do), "kw_update", "kw_set", "update_set_list"], "postprocess": x => lexer_2.box(x, { sets: last(x) }) },
            { "name": "update_statement$ebnf$1", "symbols": ["select_where"], "postprocess": id },
            { "name": "update_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "update_statement$ebnf$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_returning") ? { type: "kw_returning" } : kw_returning), "select_expr_list_aliased"], "postprocess": last },
            { "name": "update_statement$ebnf$2", "symbols": ["update_statement$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "update_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "update_statement", "symbols": ["kw_update", "table_ref_aliased", "kw_set", "update_set_list", "update_statement$ebnf$1", "update_statement$ebnf$2"], "postprocess": x => {
                    const where = unwrap(x[4]);
                    const returning = x[5];
                    return lexer_2.track(x, {
                        type: 'update',
                        table: unwrap(x[1]),
                        sets: x[3],
                        ...where ? { where } : {},
                        ...returning ? { returning } : {},
                    });
                } },
            { "name": "update_set_list$ebnf$1", "symbols": [] },
            { "name": "update_set_list$ebnf$1$subexpression$1", "symbols": ["comma", "update_set"], "postprocess": last },
            { "name": "update_set_list$ebnf$1", "symbols": ["update_set_list$ebnf$1", "update_set_list$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "update_set_list", "symbols": ["update_set", "update_set_list$ebnf$1"], "postprocess": ([head, tail]) => {
                    const ret = [];
                    for (const _t of [head, ...(tail || [])]) {
                        const t = unwrap(_t);
                        if (Array.isArray(t)) {
                            ret.push(...t);
                        }
                        else {
                            ret.push(t);
                        }
                    }
                    return ret;
                } },
            { "name": "update_set", "symbols": ["update_set_one"] },
            { "name": "update_set", "symbols": ["update_set_multiple"] },
            { "name": "update_set_one$subexpression$1", "symbols": ["expr"] },
            { "name": "update_set_one$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)], "postprocess": value },
            { "name": "update_set_one", "symbols": ["ident", (lexer_1.lexerAny.has("op_eq") ? { type: "op_eq" } : op_eq), "update_set_one$subexpression$1"], "postprocess": x => lexer_2.box(x, {
                    column: asName(x[0]),
                    value: unwrap(x[2]),
                }) },
            { "name": "update_set_multiple$subexpression$1", "symbols": ["lparen", "expr_list_raw", "rparen"], "postprocess": get(1) },
            { "name": "update_set_multiple", "symbols": ["collist_paren", (lexer_1.lexerAny.has("op_eq") ? { type: "op_eq" } : op_eq), "update_set_multiple$subexpression$1"], "postprocess": x => {
                    const cols = x[0];
                    const exprs = x[2];
                    if (cols.length !== exprs.length) {
                        throw new Error('number of columns does not match number of values');
                    }
                    return lexer_2.box(x, cols.map((x, i) => ({
                        column: asName(x),
                        value: unwrap(exprs[i]),
                    })));
                } },
            { "name": "altertable_statement$ebnf$1", "symbols": ["kw_ifexists"], "postprocess": id },
            { "name": "altertable_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altertable_statement$ebnf$2", "symbols": [(lexer_1.lexerAny.has("kw_only") ? { type: "kw_only" } : kw_only)], "postprocess": id },
            { "name": "altertable_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "altertable_statement", "symbols": ["kw_alter", (lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table), "altertable_statement$ebnf$1", "altertable_statement$ebnf$2", "table_ref", "altertable_action"], "postprocess": x => lexer_2.track(x, {
                    type: 'alter table',
                    ...x[2] ? { ifExists: true } : {},
                    ...x[3] ? { only: true } : {},
                    table: unwrap(x[4]),
                    change: unwrap(x[5]),
                }) },
            { "name": "altertable_action", "symbols": ["altertable_rename_table"] },
            { "name": "altertable_action", "symbols": ["altertable_rename_column"] },
            { "name": "altertable_action", "symbols": ["altertable_rename_constraint"] },
            { "name": "altertable_action", "symbols": ["altertable_add_column"] },
            { "name": "altertable_action", "symbols": ["altertable_drop_column"] },
            { "name": "altertable_action", "symbols": ["altertable_alter_column"] },
            { "name": "altertable_action", "symbols": ["altertable_add_constraint"] },
            { "name": "altertable_action", "symbols": ["altertable_owner"] },
            { "name": "altertable_rename_table", "symbols": ["kw_rename", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "word"], "postprocess": x => lexer_2.track(x, {
                    type: 'rename',
                    to: asName(last(x)),
                }) },
            { "name": "altertable_rename_column$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_column") ? { type: "kw_column" } : kw_column)], "postprocess": id },
            { "name": "altertable_rename_column$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altertable_rename_column", "symbols": ["kw_rename", "altertable_rename_column$ebnf$1", "ident", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "ident"], "postprocess": x => lexer_2.track(x, {
                    type: 'rename column',
                    column: asName(x[2]),
                    to: asName(last(x)),
                }) },
            { "name": "altertable_rename_constraint", "symbols": ["kw_rename", (lexer_1.lexerAny.has("kw_constraint") ? { type: "kw_constraint" } : kw_constraint), "ident", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "ident"], "postprocess": x => lexer_2.track(x, {
                    type: 'rename constraint',
                    constraint: asName(x[2]),
                    to: asName(last(x)),
                }) },
            { "name": "altertable_add_column$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_column") ? { type: "kw_column" } : kw_column)], "postprocess": id },
            { "name": "altertable_add_column$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altertable_add_column$ebnf$2", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "altertable_add_column$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "altertable_add_column", "symbols": ["kw_add", "altertable_add_column$ebnf$1", "altertable_add_column$ebnf$2", "createtable_column"], "postprocess": x => lexer_2.track(x, {
                    type: 'add column',
                    ...x[2] ? { ifNotExists: true } : {},
                    column: unwrap(x[3]),
                }) },
            { "name": "altertable_drop_column$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_column") ? { type: "kw_column" } : kw_column)], "postprocess": id },
            { "name": "altertable_drop_column$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altertable_drop_column$ebnf$2", "symbols": ["kw_ifexists"], "postprocess": id },
            { "name": "altertable_drop_column$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "altertable_drop_column", "symbols": ["kw_drop", "altertable_drop_column$ebnf$1", "altertable_drop_column$ebnf$2", "ident"], "postprocess": x => lexer_2.track(x, {
                    type: 'drop column',
                    ...x[2] ? { ifExists: true } : {},
                    column: asName(x[3]),
                }) },
            { "name": "altertable_alter_column$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_column") ? { type: "kw_column" } : kw_column)], "postprocess": id },
            { "name": "altertable_alter_column$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altertable_alter_column", "symbols": ["kw_alter", "altertable_alter_column$ebnf$1", "ident", "altercol"], "postprocess": x => lexer_2.track(x, {
                    type: 'alter column',
                    column: asName(x[2]),
                    alter: unwrap(x[3])
                }) },
            { "name": "altercol$ebnf$1$subexpression$1", "symbols": ["kw_set", "kw_data"] },
            { "name": "altercol$ebnf$1", "symbols": ["altercol$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "altercol$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altercol", "symbols": ["altercol$ebnf$1", "kw_type", "data_type"], "postprocess": x => lexer_2.track(x, { type: 'set type', dataType: unwrap(last(x)) }) },
            { "name": "altercol", "symbols": ["kw_set", (lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default), "expr"], "postprocess": x => lexer_2.track(x, { type: 'set default', default: unwrap(last(x)) }) },
            { "name": "altercol", "symbols": ["kw_drop", (lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)], "postprocess": x => lexer_2.track(x, { type: 'drop default' }) },
            { "name": "altercol$subexpression$1", "symbols": ["kw_set"] },
            { "name": "altercol$subexpression$1", "symbols": ["kw_drop"] },
            { "name": "altercol", "symbols": ["altercol$subexpression$1", "kw_not_null"], "postprocess": x => lexer_2.track(x, { type: toStr(x, ' ') }) },
            { "name": "altercol", "symbols": ["altercol_generated_add"], "postprocess": unwrap },
            { "name": "altertable_add_constraint", "symbols": ["kw_add", "createtable_constraint"], "postprocess": x => lexer_2.track(x, {
                    type: 'add constraint',
                    constraint: unwrap(last(x)),
                }) },
            { "name": "altertable_owner", "symbols": ["kw_owner", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "ident"], "postprocess": x => lexer_2.track(x, {
                    type: 'owner',
                    to: asName(last(x)),
                }) },
            { "name": "altercol_generated_add", "symbols": ["kw_add", "altercol_generated"], "postprocess": last },
            { "name": "altercol_generated$ebnf$1$subexpression$1", "symbols": ["kw_always"] },
            { "name": "altercol_generated$ebnf$1$subexpression$1", "symbols": ["kw_by", (lexer_1.lexerAny.has("kw_default") ? { type: "kw_default" } : kw_default)] },
            { "name": "altercol_generated$ebnf$1", "symbols": ["altercol_generated$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "altercol_generated$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altercol_generated$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "kw_identity"] },
            { "name": "altercol_generated$ebnf$2$subexpression$1", "symbols": ["lparen", "altercol_generated_seq", "rparen"], "postprocess": get(1) },
            { "name": "altercol_generated$ebnf$2", "symbols": ["altercol_generated$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "altercol_generated$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "altercol_generated", "symbols": ["kw_generated", "altercol_generated$ebnf$1", "altercol_generated$subexpression$1", "altercol_generated$ebnf$2"], "postprocess": x => lexer_2.track(x, {
                    type: 'add generated',
                    ...x[1] && { always: toStr(x[1], ' ') },
                    ...x[3] && { sequence: unwrap(x[3]) },
                }) },
            { "name": "altercol_generated_seq$ebnf$1$subexpression$1", "symbols": ["kw_sequence", "kw_name", "qualified_name"] },
            { "name": "altercol_generated_seq$ebnf$1", "symbols": ["altercol_generated_seq$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "altercol_generated_seq$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "altercol_generated_seq$ebnf$2", "symbols": [] },
            { "name": "altercol_generated_seq$ebnf$2", "symbols": ["altercol_generated_seq$ebnf$2", "create_sequence_option"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "altercol_generated_seq", "symbols": ["altercol_generated_seq$ebnf$1", "altercol_generated_seq$ebnf$2"], "postprocess": x => {
                    const ret = {
                        ...x[0] && { name: unwrap(last(x[0])) },
                    };
                    setSeqOpts(ret, x[1]);
                    return lexer_2.track(x, ret);
                } },
            { "name": "delete_statement", "symbols": ["delete_delete"] },
            { "name": "delete_statement", "symbols": ["delete_truncate"] },
            { "name": "delete_delete$subexpression$1", "symbols": ["kw_delete", (lexer_1.lexerAny.has("kw_from") ? { type: "kw_from" } : kw_from)] },
            { "name": "delete_delete$ebnf$1", "symbols": ["select_where"], "postprocess": id },
            { "name": "delete_delete$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "delete_delete$ebnf$2$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_returning") ? { type: "kw_returning" } : kw_returning), "select_expr_list_aliased"], "postprocess": last },
            { "name": "delete_delete$ebnf$2", "symbols": ["delete_delete$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "delete_delete$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "delete_delete", "symbols": ["delete_delete$subexpression$1", "table_ref_aliased", "delete_delete$ebnf$1", "delete_delete$ebnf$2"], "postprocess": x => {
                    const where = x[2];
                    const returning = x[3];
                    return lexer_2.track(x, {
                        type: 'delete',
                        from: unwrap(x[1]),
                        ...where ? { where } : {},
                        ...returning ? { returning } : {},
                    });
                } },
            { "name": "delete_truncate$subexpression$1$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table)], "postprocess": id },
            { "name": "delete_truncate$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "delete_truncate$subexpression$1", "symbols": ["kw_truncate", "delete_truncate$subexpression$1$ebnf$1"] },
            { "name": "delete_truncate$macrocall$2", "symbols": ["table_ref"] },
            { "name": "delete_truncate$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "delete_truncate$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "delete_truncate$macrocall$2"], "postprocess": last },
            { "name": "delete_truncate$macrocall$1$ebnf$1", "symbols": ["delete_truncate$macrocall$1$ebnf$1", "delete_truncate$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "delete_truncate$macrocall$1", "symbols": ["delete_truncate$macrocall$2", "delete_truncate$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "delete_truncate$ebnf$1$subexpression$1$subexpression$1", "symbols": ["kw_restart"] },
            { "name": "delete_truncate$ebnf$1$subexpression$1$subexpression$1", "symbols": ["kw_continue"] },
            { "name": "delete_truncate$ebnf$1$subexpression$1", "symbols": ["delete_truncate$ebnf$1$subexpression$1$subexpression$1", "kw_identity"] },
            { "name": "delete_truncate$ebnf$1", "symbols": ["delete_truncate$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "delete_truncate$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "delete_truncate", "symbols": ["delete_truncate$subexpression$1", "delete_truncate$macrocall$1", "delete_truncate$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    type: 'truncate table',
                    tables: x[1],
                    ...x[2] && { identity: toStr(x[2][0]) }
                }) },
            { "name": "create_sequence_statement$ebnf$1$subexpression$1", "symbols": ["kw_temp"] },
            { "name": "create_sequence_statement$ebnf$1$subexpression$1", "symbols": ["kw_temporary"] },
            { "name": "create_sequence_statement$ebnf$1", "symbols": ["create_sequence_statement$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "create_sequence_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_sequence_statement$ebnf$2", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "create_sequence_statement$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "create_sequence_statement$ebnf$3", "symbols": [] },
            { "name": "create_sequence_statement$ebnf$3", "symbols": ["create_sequence_statement$ebnf$3", "create_sequence_option"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "create_sequence_statement", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "create_sequence_statement$ebnf$1", "kw_sequence", "create_sequence_statement$ebnf$2", "qualified_name", "create_sequence_statement$ebnf$3"], "postprocess": x => {
                    const ret = {
                        type: 'create sequence',
                        ...x[1] && { temp: true },
                        ...x[3] && { ifNotExists: true },
                        name: unwrap(x[4]),
                        options: {},
                    };
                    setSeqOpts(ret.options, x[5]);
                    return lexer_2.track(x, ret);
                } },
            { "name": "create_sequence_option", "symbols": [(lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "data_type"], "postprocess": x => lexer_2.box(x, ['as', x[1]]) },
            { "name": "create_sequence_option$ebnf$1", "symbols": ["kw_by"], "postprocess": id },
            { "name": "create_sequence_option$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_sequence_option", "symbols": ["kw_increment", "create_sequence_option$ebnf$1", "int"], "postprocess": x => lexer_2.box(x, ['incrementBy', x[2]]) },
            { "name": "create_sequence_option", "symbols": ["create_sequence_minvalue"], "postprocess": x => lexer_2.box(x, ['minValue', x[0]]) },
            { "name": "create_sequence_option", "symbols": ["create_sequence_maxvalue"], "postprocess": x => lexer_2.box(x, ['maxValue', x[0]]) },
            { "name": "create_sequence_option$ebnf$2", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with)], "postprocess": id },
            { "name": "create_sequence_option$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "create_sequence_option", "symbols": ["kw_start", "create_sequence_option$ebnf$2", "int"], "postprocess": x => lexer_2.box(x, ['startWith', x[2]]) },
            { "name": "create_sequence_option", "symbols": ["kw_cache", "int"], "postprocess": x => lexer_2.box(x, ['cache', x[1]]) },
            { "name": "create_sequence_option$ebnf$3", "symbols": ["kw_no"], "postprocess": id },
            { "name": "create_sequence_option$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "create_sequence_option", "symbols": ["create_sequence_option$ebnf$3", "kw_cycle"], "postprocess": x => lexer_2.box(x, ['cycle', toStr(x, ' ')]) },
            { "name": "create_sequence_option", "symbols": ["create_sequence_owned_by"], "postprocess": x => lexer_2.box(x, ['ownedBy', unwrap(x)]) },
            { "name": "create_sequence_minvalue", "symbols": ["kw_minvalue", "int"], "postprocess": last },
            { "name": "create_sequence_minvalue", "symbols": ["kw_no", "kw_minvalue"], "postprocess": x => lexer_2.box(x, 'no minvalue') },
            { "name": "create_sequence_maxvalue", "symbols": ["kw_maxvalue", "int"], "postprocess": last },
            { "name": "create_sequence_maxvalue", "symbols": ["kw_no", "kw_maxvalue"], "postprocess": x => lexer_2.box(x, 'no maxvalue') },
            { "name": "create_sequence_owned_by$subexpression$1", "symbols": ["kw_none"] },
            { "name": "create_sequence_owned_by$subexpression$1", "symbols": ["qcolumn"] },
            { "name": "create_sequence_owned_by", "symbols": ["kw_owned", "kw_by", "create_sequence_owned_by$subexpression$1"], "postprocess": x => lexer_2.box(x, unwrap(last(x))) },
            { "name": "alter_sequence_statement$ebnf$1", "symbols": ["kw_ifexists"], "postprocess": id },
            { "name": "alter_sequence_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "alter_sequence_statement", "symbols": ["kw_alter", "kw_sequence", "alter_sequence_statement$ebnf$1", "qualified_name", "alter_sequence_statement_body"], "postprocess": x => {
                    const ret = {
                        type: 'alter sequence',
                        ...x[2] && { ifExists: true },
                        name: unwrap(x[3]),
                        change: x[4],
                    };
                    return lexer_2.track(x, ret);
                } },
            { "name": "alter_sequence_statement_body$ebnf$1", "symbols": ["alter_sequence_option"] },
            { "name": "alter_sequence_statement_body$ebnf$1", "symbols": ["alter_sequence_statement_body$ebnf$1", "alter_sequence_option"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "alter_sequence_statement_body", "symbols": ["alter_sequence_statement_body$ebnf$1"], "postprocess": x => {
                    const ret = {
                        type: 'set options',
                    };
                    setSeqOpts(ret, x[0]);
                    return lexer_2.track(x, ret);
                } },
            { "name": "alter_sequence_statement_body$subexpression$1", "symbols": ["ident"] },
            { "name": "alter_sequence_statement_body$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_session_user") ? { type: "kw_session_user" } : kw_session_user)] },
            { "name": "alter_sequence_statement_body$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_current_user") ? { type: "kw_current_user" } : kw_current_user)] },
            { "name": "alter_sequence_statement_body", "symbols": ["kw_owner", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "alter_sequence_statement_body$subexpression$1"], "postprocess": x => lexer_2.track(x, { type: 'owner to', owner: asName(last(x)), }) },
            { "name": "alter_sequence_statement_body", "symbols": ["kw_rename", (lexer_1.lexerAny.has("kw_to") ? { type: "kw_to" } : kw_to), "ident"], "postprocess": x => lexer_2.track(x, { type: 'rename', newName: asName(last(x)) }) },
            { "name": "alter_sequence_statement_body", "symbols": ["kw_set", "kw_schema", "ident"], "postprocess": x => lexer_2.track(x, { type: 'set schema', newSchema: asName(last(x)) }) },
            { "name": "alter_sequence_option", "symbols": ["create_sequence_option"], "postprocess": unwrap },
            { "name": "alter_sequence_option$ebnf$1$subexpression$1$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with)], "postprocess": id },
            { "name": "alter_sequence_option$ebnf$1$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "alter_sequence_option$ebnf$1$subexpression$1", "symbols": ["alter_sequence_option$ebnf$1$subexpression$1$ebnf$1", "int"], "postprocess": last },
            { "name": "alter_sequence_option$ebnf$1", "symbols": ["alter_sequence_option$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "alter_sequence_option$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "alter_sequence_option", "symbols": ["kw_restart", "alter_sequence_option$ebnf$1"], "postprocess": x => lexer_2.box(x, ['restart', typeof lexer_2.unbox(x[1]) === 'number' ? lexer_2.unbox(x[1]) : true]) },
            { "name": "drop_statement$ebnf$1", "symbols": ["kw_ifexists"], "postprocess": id },
            { "name": "drop_statement$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "drop_statement", "symbols": ["kw_drop", "drop_what", "drop_statement$ebnf$1", "qualified_name"], "postprocess": (x, rej) => {
                    const v = unwrap(x[1]);
                    return lexer_2.track(x, {
                        ...v,
                        ...x[2] && { ifExists: true },
                        name: unwrap(x[3]),
                    });
                } },
            { "name": "drop_what", "symbols": [(lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table)], "postprocess": x => lexer_2.track(x, { type: 'drop table' }) },
            { "name": "drop_what", "symbols": ["kw_sequence"], "postprocess": x => lexer_2.track(x, { type: 'drop sequence' }) },
            { "name": "drop_what$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_concurrently") ? { type: "kw_concurrently" } : kw_concurrently)], "postprocess": id },
            { "name": "drop_what$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "drop_what", "symbols": ["kw_index", "drop_what$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    type: 'drop index',
                    ...x[1] && { concurrently: true },
                }) },
            { "name": "with_statement", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with), "with_statement_bindings", "with_statement_statement"], "postprocess": x => lexer_2.track(x, {
                    type: 'with',
                    bind: x[1],
                    in: unwrap(x[2]),
                }) },
            { "name": "with_recursive_statement$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with), "kw_recursive"] },
            { "name": "with_recursive_statement", "symbols": ["with_recursive_statement$subexpression$1", "ident", "collist_paren", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "lparen", "union_statement", "rparen", "with_statement_statement"], "postprocess": x => lexer_2.track(x, {
                    type: 'with recursive',
                    alias: asName(x[1]),
                    columnNames: x[2].map(asName),
                    bind: x[5],
                    in: unwrap(x[7]),
                }) },
            { "name": "with_statement_bindings$ebnf$1", "symbols": [] },
            { "name": "with_statement_bindings$ebnf$1$subexpression$1", "symbols": ["comma", "with_statement_binding"], "postprocess": last },
            { "name": "with_statement_bindings$ebnf$1", "symbols": ["with_statement_bindings$ebnf$1", "with_statement_bindings$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "with_statement_bindings", "symbols": ["with_statement_binding", "with_statement_bindings$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "with_statement_binding", "symbols": ["word", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "lparen", "with_statement_statement", "rparen"], "postprocess": x => lexer_2.track(x, {
                    alias: asName(x[0]),
                    statement: unwrap(x[3]),
                }) },
            { "name": "with_statement_statement", "symbols": ["selection"] },
            { "name": "with_statement_statement", "symbols": ["insert_statement"] },
            { "name": "with_statement_statement", "symbols": ["update_statement"] },
            { "name": "with_statement_statement", "symbols": ["delete_statement"] },
            { "name": "createtype_statement$subexpression$1", "symbols": ["createtype_enum"] },
            { "name": "createtype_statement", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "kw_type", "qualified_name", "createtype_statement$subexpression$1"], "postprocess": x => lexer_2.track(x, {
                    name: x[2],
                    ...unwrap(x[3]),
                }) },
            { "name": "createtype_enum$macrocall$2", "symbols": ["enum_value"] },
            { "name": "createtype_enum$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "createtype_enum$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "createtype_enum$macrocall$2"], "postprocess": last },
            { "name": "createtype_enum$macrocall$1$ebnf$1", "symbols": ["createtype_enum$macrocall$1$ebnf$1", "createtype_enum$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "createtype_enum$macrocall$1", "symbols": ["createtype_enum$macrocall$2", "createtype_enum$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "createtype_enum", "symbols": [(lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "kw_enum", "lparen", "createtype_enum$macrocall$1", "rparen"], "postprocess": x => lexer_2.track(x, {
                    type: 'create enum',
                    values: x[3],
                }) },
            { "name": "enum_value", "symbols": ["string"], "postprocess": x => lexer_2.track(x, { value: toStr(x) }) },
            { "name": "union_left", "symbols": ["select_statement"] },
            { "name": "union_left", "symbols": ["select_values"] },
            { "name": "union_left", "symbols": ["selection_paren"] },
            { "name": "union_right", "symbols": ["selection"] },
            { "name": "union_right", "symbols": ["selection_paren"] },
            { "name": "union_statement$subexpression$1$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_all") ? { type: "kw_all" } : kw_all)], "postprocess": id },
            { "name": "union_statement$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "union_statement$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_union") ? { type: "kw_union" } : kw_union), "union_statement$subexpression$1$ebnf$1"] },
            { "name": "union_statement", "symbols": ["union_left", "union_statement$subexpression$1", "union_right"], "postprocess": x => {
                    return lexer_2.track(x, {
                        type: toStr(x[1], ' '),
                        left: unwrap(x[0]),
                        right: unwrap(x[2]),
                    });
                } },
            { "name": "prepare$ebnf$1$subexpression$1", "symbols": ["lparen", "data_type_list", "rparen"], "postprocess": get(1) },
            { "name": "prepare$ebnf$1", "symbols": ["prepare$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "prepare$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "prepare", "symbols": ["kw_prepare", "ident", "prepare$ebnf$1", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "statement_noprep"], "postprocess": x => lexer_2.track(x, {
                    type: 'prepare',
                    name: asName(x[1]),
                    ...x[2] && { args: x[2] },
                    statement: unwrap(last(x)),
                }) },
            { "name": "create_view_statements", "symbols": ["create_view"] },
            { "name": "create_view_statements", "symbols": ["create_materialized_view"] },
            { "name": "create_view$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_or") ? { type: "kw_or" } : kw_or), "kw_replace"] },
            { "name": "create_view$ebnf$1", "symbols": ["create_view$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "create_view$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_view$ebnf$2$subexpression$1", "symbols": ["kw_temp"] },
            { "name": "create_view$ebnf$2$subexpression$1", "symbols": ["kw_temporary"] },
            { "name": "create_view$ebnf$2", "symbols": ["create_view$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "create_view$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "create_view$ebnf$3", "symbols": ["kw_recursive"], "postprocess": id },
            { "name": "create_view$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "create_view$ebnf$4$subexpression$1$macrocall$2", "symbols": ["ident"] },
            { "name": "create_view$ebnf$4$subexpression$1$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "create_view$ebnf$4$subexpression$1$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "create_view$ebnf$4$subexpression$1$macrocall$2"], "postprocess": last },
            { "name": "create_view$ebnf$4$subexpression$1$macrocall$1$ebnf$1", "symbols": ["create_view$ebnf$4$subexpression$1$macrocall$1$ebnf$1", "create_view$ebnf$4$subexpression$1$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "create_view$ebnf$4$subexpression$1$macrocall$1", "symbols": ["create_view$ebnf$4$subexpression$1$macrocall$2", "create_view$ebnf$4$subexpression$1$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "create_view$ebnf$4$subexpression$1", "symbols": ["lparen", "create_view$ebnf$4$subexpression$1$macrocall$1", "rparen"], "postprocess": get(1) },
            { "name": "create_view$ebnf$4", "symbols": ["create_view$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "create_view$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "create_view$ebnf$5", "symbols": ["create_view_opts"], "postprocess": id },
            { "name": "create_view$ebnf$5", "symbols": [], "postprocess": () => null },
            { "name": "create_view$ebnf$6$subexpression$1$subexpression$1", "symbols": ["kw_local"] },
            { "name": "create_view$ebnf$6$subexpression$1$subexpression$1", "symbols": ["kw_cascaded"] },
            { "name": "create_view$ebnf$6$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with), "create_view$ebnf$6$subexpression$1$subexpression$1", (lexer_1.lexerAny.has("kw_check") ? { type: "kw_check" } : kw_check), "kw_option"], "postprocess": get(1) },
            { "name": "create_view$ebnf$6", "symbols": ["create_view$ebnf$6$subexpression$1"], "postprocess": id },
            { "name": "create_view$ebnf$6", "symbols": [], "postprocess": () => null },
            { "name": "create_view", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "create_view$ebnf$1", "create_view$ebnf$2", "create_view$ebnf$3", "kw_view", "qualified_name", "create_view$ebnf$4", "create_view$ebnf$5", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "selection", "create_view$ebnf$6"], "postprocess": x => {
                    return lexer_2.track(x, {
                        type: 'create view',
                        ...x[1] && { orReplace: true },
                        ...x[2] && { temp: true },
                        ...x[3] && { recursive: true },
                        name: x[5],
                        ...x[6] && { columnNames: x[6].map(asName) },
                        ...x[7] && { parameters: fromEntries(x[7]) },
                        query: x[9],
                        ...x[10] && { checkOption: toStr(x[10]) },
                    });
                } },
            { "name": "create_view_opt", "symbols": ["ident", (lexer_1.lexerAny.has("op_eq") ? { type: "op_eq" } : op_eq), "ident"], "postprocess": ([a, _, b]) => [toStr(a), toStr(b)] },
            { "name": "create_view_opts$macrocall$2", "symbols": ["create_view_opt"] },
            { "name": "create_view_opts$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "create_view_opts$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "create_view_opts$macrocall$2"], "postprocess": last },
            { "name": "create_view_opts$macrocall$1$ebnf$1", "symbols": ["create_view_opts$macrocall$1$ebnf$1", "create_view_opts$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "create_view_opts$macrocall$1", "symbols": ["create_view_opts$macrocall$2", "create_view_opts$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "create_view_opts", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with), "create_view_opts$macrocall$1"], "postprocess": last },
            { "name": "create_materialized_view$ebnf$1", "symbols": ["kw_ifnotexists"], "postprocess": id },
            { "name": "create_materialized_view$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_materialized_view$ebnf$2$subexpression$1$macrocall$2", "symbols": ["ident"] },
            { "name": "create_materialized_view$ebnf$2$subexpression$1$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "create_materialized_view$ebnf$2$subexpression$1$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "create_materialized_view$ebnf$2$subexpression$1$macrocall$2"], "postprocess": last },
            { "name": "create_materialized_view$ebnf$2$subexpression$1$macrocall$1$ebnf$1", "symbols": ["create_materialized_view$ebnf$2$subexpression$1$macrocall$1$ebnf$1", "create_materialized_view$ebnf$2$subexpression$1$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "create_materialized_view$ebnf$2$subexpression$1$macrocall$1", "symbols": ["create_materialized_view$ebnf$2$subexpression$1$macrocall$2", "create_materialized_view$ebnf$2$subexpression$1$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "create_materialized_view$ebnf$2$subexpression$1", "symbols": ["lparen", "create_materialized_view$ebnf$2$subexpression$1$macrocall$1", "rparen"], "postprocess": get(1) },
            { "name": "create_materialized_view$ebnf$2", "symbols": ["create_materialized_view$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "create_materialized_view$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "create_materialized_view$ebnf$3", "symbols": ["create_view_opts"], "postprocess": id },
            { "name": "create_materialized_view$ebnf$3", "symbols": [], "postprocess": () => null },
            { "name": "create_materialized_view$ebnf$4$subexpression$1", "symbols": ["kw_tablespace", "ident"], "postprocess": last },
            { "name": "create_materialized_view$ebnf$4", "symbols": ["create_materialized_view$ebnf$4$subexpression$1"], "postprocess": id },
            { "name": "create_materialized_view$ebnf$4", "symbols": [], "postprocess": () => null },
            { "name": "create_materialized_view$ebnf$5$subexpression$1$ebnf$1", "symbols": ["kw_no"], "postprocess": id },
            { "name": "create_materialized_view$ebnf$5$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_materialized_view$ebnf$5$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_with") ? { type: "kw_with" } : kw_with), "create_materialized_view$ebnf$5$subexpression$1$ebnf$1", "kw_data"] },
            { "name": "create_materialized_view$ebnf$5", "symbols": ["create_materialized_view$ebnf$5$subexpression$1"], "postprocess": id },
            { "name": "create_materialized_view$ebnf$5", "symbols": [], "postprocess": () => null },
            { "name": "create_materialized_view", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "kw_materialized", "kw_view", "create_materialized_view$ebnf$1", "qualified_name", "create_materialized_view$ebnf$2", "create_materialized_view$ebnf$3", "create_materialized_view$ebnf$4", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "selection", "create_materialized_view$ebnf$5"], "postprocess": x => {
                    return lexer_2.track(x, {
                        type: 'create materialized view',
                        ...x[3] && { ifNotExists: true },
                        name: x[4],
                        ...x[5] && { columnNames: x[6].map(asName) },
                        ...x[6] && { parameters: fromEntries(x[6]) },
                        ...x[7] && { tablespace: asName(x[7]) },
                        query: x[9],
                        ...x[10] && { withData: toStr(x[10][1]) !== 'no' },
                    });
                } },
            { "name": "functions_statements", "symbols": ["create_func"] },
            { "name": "functions_statements", "symbols": ["do_stm"] },
            { "name": "create_func$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("kw_or") ? { type: "kw_or" } : kw_or), "kw_replace"] },
            { "name": "create_func$ebnf$1", "symbols": ["create_func$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "create_func$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_func$subexpression$1$ebnf$1$macrocall$2", "symbols": ["func_argdef"] },
            { "name": "create_func$subexpression$1$ebnf$1$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "create_func$subexpression$1$ebnf$1$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "create_func$subexpression$1$ebnf$1$macrocall$2"], "postprocess": last },
            { "name": "create_func$subexpression$1$ebnf$1$macrocall$1$ebnf$1", "symbols": ["create_func$subexpression$1$ebnf$1$macrocall$1$ebnf$1", "create_func$subexpression$1$ebnf$1$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "create_func$subexpression$1$ebnf$1$macrocall$1", "symbols": ["create_func$subexpression$1$ebnf$1$macrocall$2", "create_func$subexpression$1$ebnf$1$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "create_func$subexpression$1$ebnf$1", "symbols": ["create_func$subexpression$1$ebnf$1$macrocall$1"], "postprocess": id },
            { "name": "create_func$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "create_func$subexpression$1", "symbols": ["lparen", "create_func$subexpression$1$ebnf$1", "rparen"], "postprocess": get(1) },
            { "name": "create_func$ebnf$2", "symbols": ["func_returns"], "postprocess": id },
            { "name": "create_func$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "create_func$subexpression$2", "symbols": [(lexer_1.lexerAny.has("codeblock") ? { type: "codeblock" } : codeblock)], "postprocess": x => unwrap(x).value },
            { "name": "create_func$subexpression$2", "symbols": ["string"] },
            { "name": "create_func$ebnf$3", "symbols": [] },
            { "name": "create_func$ebnf$3", "symbols": ["create_func$ebnf$3", "func_spec"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "create_func", "symbols": [(lexer_1.lexerAny.has("kw_create") ? { type: "kw_create" } : kw_create), "create_func$ebnf$1", "kw_function", "qname", "create_func$subexpression$1", "create_func$ebnf$2", (lexer_1.lexerAny.has("kw_as") ? { type: "kw_as" } : kw_as), "create_func$subexpression$2", "create_func$ebnf$3"], "postprocess": x => {
                    var _a;
                    const specs = {};
                    for (const s of x[8]) {
                        Object.assign(specs, s);
                    }
                    return lexer_2.track(x, {
                        type: 'create function',
                        ...x[1] && { orReplace: true },
                        name: x[3],
                        ...x[5] && { returns: unwrap(x[5]) },
                        arguments: (_a = x[4]) !== null && _a !== void 0 ? _a : [],
                        code: unwrap(x[7]),
                        ...specs,
                    });
                } },
            { "name": "func_argdef$ebnf$1", "symbols": ["func_argopts"], "postprocess": id },
            { "name": "func_argdef$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "func_argdef", "symbols": ["func_argdef$ebnf$1", "data_type"], "postprocess": x => lexer_2.track(x, {
                    type: x[1],
                    ...x[0],
                }) },
            { "name": "func_argopts$ebnf$1", "symbols": ["word"], "postprocess": id },
            { "name": "func_argopts$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "func_argopts", "symbols": ["func_argmod", "func_argopts$ebnf$1"], "postprocess": x => lexer_2.track(x, {
                    mode: toStr(x[0]),
                    ...x[1] && { name: asName(x[1]) },
                }) },
            { "name": "func_argopts", "symbols": ["word"], "postprocess": (x, rej) => {
                    const name = asName(x);
                    if (name === 'out' || name === 'inout' || name === 'variadic') {
                        return rej; // avoid ambiguous syntax
                    }
                    return lexer_2.track(x, { name });
                } },
            { "name": "func_argmod", "symbols": [(lexer_1.lexerAny.has("kw_in") ? { type: "kw_in" } : kw_in)] },
            { "name": "func_argmod", "symbols": ["kw_out"] },
            { "name": "func_argmod", "symbols": ["kw_inout"] },
            { "name": "func_argmod", "symbols": ["kw_variadic"] },
            { "name": "func_spec", "symbols": ["kw_language", "word"], "postprocess": x => lexer_2.track(x, { language: asName(last(x)) }) },
            { "name": "func_spec", "symbols": ["func_purity"], "postprocess": x => lexer_2.track(x, { purity: toStr(x) }) },
            { "name": "func_spec$ebnf$1", "symbols": [(lexer_1.lexerAny.has("kw_not") ? { type: "kw_not" } : kw_not)], "postprocess": id },
            { "name": "func_spec$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "func_spec$subexpression$1", "symbols": ["word"], "postprocess": kw('leakproof') },
            { "name": "func_spec", "symbols": ["func_spec$ebnf$1", "func_spec$subexpression$1"], "postprocess": x => lexer_2.track(x, { leakproof: !x[0] }) },
            { "name": "func_spec", "symbols": ["func_spec_nil"], "postprocess": unwrap },
            { "name": "func_spec_nil$subexpression$1", "symbols": ["word"], "postprocess": kw('called') },
            { "name": "func_spec_nil", "symbols": ["func_spec_nil$subexpression$1", "oninp"], "postprocess": () => ({ onNullInput: 'call' }) },
            { "name": "func_spec_nil$subexpression$2", "symbols": ["word"], "postprocess": kw('returns') },
            { "name": "func_spec_nil", "symbols": ["func_spec_nil$subexpression$2", (lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null), "oninp"], "postprocess": () => ({ onNullInput: 'null' }) },
            { "name": "func_spec_nil$subexpression$3", "symbols": ["word"], "postprocess": kw('strict') },
            { "name": "func_spec_nil", "symbols": ["func_spec_nil$subexpression$3"], "postprocess": () => ({ onNullInput: 'strict' }) },
            { "name": "func_purity", "symbols": ["word"], "postprocess": kw('immutable') },
            { "name": "func_purity", "symbols": ["word"], "postprocess": kw('stable') },
            { "name": "func_purity", "symbols": ["word"], "postprocess": kw('volatile') },
            { "name": "oninp$subexpression$1", "symbols": ["word"], "postprocess": kw('input') },
            { "name": "oninp", "symbols": [(lexer_1.lexerAny.has("kw_on") ? { type: "kw_on" } : kw_on), (lexer_1.lexerAny.has("kw_null") ? { type: "kw_null" } : kw_null), "oninp$subexpression$1"] },
            { "name": "func_returns", "symbols": ["kw_returns", "data_type"], "postprocess": last },
            { "name": "func_returns$macrocall$2", "symbols": ["func_ret_table_col"] },
            { "name": "func_returns$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "func_returns$macrocall$1$ebnf$1$subexpression$1", "symbols": [(lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "func_returns$macrocall$2"], "postprocess": last },
            { "name": "func_returns$macrocall$1$ebnf$1", "symbols": ["func_returns$macrocall$1$ebnf$1", "func_returns$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "func_returns$macrocall$1", "symbols": ["func_returns$macrocall$2", "func_returns$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "func_returns", "symbols": ["kw_returns", (lexer_1.lexerAny.has("kw_table") ? { type: "kw_table" } : kw_table), "lparen", "func_returns$macrocall$1", "rparen"], "postprocess": x => lexer_2.track(x, {
                    kind: 'table',
                    columns: x[3],
                }) },
            { "name": "func_ret_table_col", "symbols": ["word", "data_type"], "postprocess": x => lexer_2.track(x, { name: asName(x[0]), type: x[1] }) },
            { "name": "do_stm$ebnf$1$subexpression$1", "symbols": ["kw_language", "word"], "postprocess": last },
            { "name": "do_stm$ebnf$1", "symbols": ["do_stm$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "do_stm$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "do_stm", "symbols": [(lexer_1.lexerAny.has("kw_do") ? { type: "kw_do" } : kw_do), "do_stm$ebnf$1", (lexer_1.lexerAny.has("codeblock") ? { type: "codeblock" } : codeblock)], "postprocess": x => lexer_2.track(x, {
                    type: 'do',
                    ...x[1] && { language: asName(x[1]) },
                    code: x[2].value,
                }) },
            { "name": "main$ebnf$1", "symbols": [] },
            { "name": "main$ebnf$1", "symbols": ["main$ebnf$1", "statement_separator"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main$ebnf$2", "symbols": [] },
            { "name": "main$ebnf$2$subexpression$1$ebnf$1", "symbols": ["statement_separator"] },
            { "name": "main$ebnf$2$subexpression$1$ebnf$1", "symbols": ["main$ebnf$2$subexpression$1$ebnf$1", "statement_separator"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main$ebnf$2$subexpression$1", "symbols": ["main$ebnf$2$subexpression$1$ebnf$1", "statement"] },
            { "name": "main$ebnf$2", "symbols": ["main$ebnf$2", "main$ebnf$2$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main$ebnf$3", "symbols": [] },
            { "name": "main$ebnf$3", "symbols": ["main$ebnf$3", "statement_separator"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main", "symbols": ["main$ebnf$1", "statement", "main$ebnf$2", "main$ebnf$3"], "postprocess": ([_, head, _tail]) => {
                    const tail = _tail;
                    const ret = [unwrap(head), ...tail.map((x) => unwrap(x[1]))];
                    return ret.length === 1
                        ? ret[0]
                        : ret;
                } },
            { "name": "statement_separator", "symbols": [(lexer_1.lexerAny.has("semicolon") ? { type: "semicolon" } : semicolon)] },
            { "name": "statement", "symbols": ["statement_noprep"] },
            { "name": "statement", "symbols": ["prepare"] },
            { "name": "statement_noprep", "symbols": ["selection"] },
            { "name": "statement_noprep", "symbols": ["createtable_statement"] },
            { "name": "statement_noprep", "symbols": ["createextension_statement"] },
            { "name": "statement_noprep", "symbols": ["createindex_statement"] },
            { "name": "statement_noprep", "symbols": ["simplestatements_all"] },
            { "name": "statement_noprep", "symbols": ["insert_statement"] },
            { "name": "statement_noprep", "symbols": ["update_statement"] },
            { "name": "statement_noprep", "symbols": ["altertable_statement"] },
            { "name": "statement_noprep", "symbols": ["delete_statement"] },
            { "name": "statement_noprep", "symbols": ["create_sequence_statement"] },
            { "name": "statement_noprep", "symbols": ["alter_sequence_statement"] },
            { "name": "statement_noprep", "symbols": ["drop_statement"] },
            { "name": "statement_noprep", "symbols": ["createtype_statement"] },
            { "name": "statement_noprep", "symbols": ["create_view_statements"] },
            { "name": "statement_noprep", "symbols": ["create_schema"] },
            { "name": "statement_noprep", "symbols": ["raise_statement"] },
            { "name": "statement_noprep", "symbols": ["comment_statement"] },
            { "name": "statement_noprep", "symbols": ["functions_statements"] },
            { "name": "selection", "symbols": ["select_statement"], "postprocess": unwrap },
            { "name": "selection", "symbols": ["select_values"], "postprocess": unwrap },
            { "name": "selection", "symbols": ["with_statement"], "postprocess": unwrap },
            { "name": "selection", "symbols": ["with_recursive_statement"], "postprocess": unwrap },
            { "name": "selection", "symbols": ["union_statement"], "postprocess": unwrap },
            { "name": "selection_paren", "symbols": ["lparen", "selection", "rparen"], "postprocess": get(1) }
        ],
        ParserStart: "main",
    };
    exports.default = grammar;


    /***/ }),
    /* 11 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    // Generated automatically by nearley, version unknown
    // http://github.com/Hardmath123/nearley
    // Bypasses TS6133. Allow declared but unused functions.
    // @ts-ignore
    function id(d) { return d[0]; }
    const array_lexer_1 = __webpack_require__(12);
    const last = (x) => x && x[x.length - 1];
    const grammar = {
        Lexer: array_lexer_1.lexerAny,
        ParserRules: [
            { "name": "main$ebnf$1", "symbols": ["elements"], "postprocess": id },
            { "name": "main$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "main", "symbols": [(array_lexer_1.lexerAny.has("start_list") ? { type: "start_list" } : start_list), "main$ebnf$1", (array_lexer_1.lexerAny.has("end_list") ? { type: "end_list" } : end_list)], "postprocess": x => x[1] || [] },
            { "name": "elements$ebnf$1", "symbols": [] },
            { "name": "elements$ebnf$1$subexpression$1", "symbols": [(array_lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "elt"], "postprocess": last },
            { "name": "elements$ebnf$1", "symbols": ["elements$ebnf$1", "elements$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "elements", "symbols": ["elt", "elements$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [head, ...(tail || [])];
                } },
            { "name": "elt", "symbols": [(array_lexer_1.lexerAny.has("value") ? { type: "value" } : value)], "postprocess": x => x[0].value },
            { "name": "elt", "symbols": ["main"], "postprocess": x => x[0] }
        ],
        ParserStart: "main",
    };
    exports.default = grammar;


    /***/ }),
    /* 12 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lexerAny = exports.lexer = void 0;
    const moo_1 = __webpack_require__(0);
    // build lexer
    exports.lexer = moo_1.compile({
        valueString: {
            match: /"(?:\\["\\]|[^\n"\\])*"/,
            value: x => JSON.parse(x),
            type: x => 'value',
        },
        valueRaw: {
            match: /[^\s,\{\}"](?:[^,\{\}"]*[^\s,\{\}"])?/,
            type: () => 'value',
        },
        comma: ',',
        space: { match: /[\s\t\n\v\f\r]+/, lineBreaks: true, },
        start_list: '{',
        end_list: '}',
    });
    exports.lexer.next = (next => () => {
        let tok;
        while ((tok = next.call(exports.lexer)) && (tok.type === 'space')) {
        }
        return tok;
    })(exports.lexer.next);
    exports.lexerAny = exports.lexer;


    /***/ }),
    /* 13 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    // Generated automatically by nearley, version unknown
    // http://github.com/Hardmath123/nearley
    // Bypasses TS6133. Allow declared but unused functions.
    // @ts-ignore
    function id(d) { return d[0]; }
    const geometric_lexer_1 = __webpack_require__(14);
    const get = (i) => (x) => x[i];
    const last = (x) => x && x[x.length - 1];
    function unwrap(e) {
        if (Array.isArray(e) && e.length === 1) {
            e = unwrap(e[0]);
        }
        if (Array.isArray(e) && !e.length) {
            return null;
        }
        return e;
    }
    const grammar = {
        Lexer: geometric_lexer_1.lexerAny,
        ParserRules: [
            { "name": "number$subexpression$1", "symbols": ["float"] },
            { "name": "number$subexpression$1", "symbols": ["int"] },
            { "name": "number", "symbols": ["number$subexpression$1"], "postprocess": unwrap },
            { "name": "float", "symbols": [(geometric_lexer_1.lexerAny.has("float") ? { type: "float" } : float)], "postprocess": args => parseFloat(unwrap(args)) },
            { "name": "int", "symbols": [(geometric_lexer_1.lexerAny.has("int") ? { type: "int" } : int)], "postprocess": arg => parseInt(unwrap(arg), 10) },
            { "name": "comma", "symbols": [(geometric_lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma)], "postprocess": id },
            { "name": "point$macrocall$2", "symbols": ["point_content"] },
            { "name": "point$macrocall$1$subexpression$1", "symbols": ["point$macrocall$2"] },
            { "name": "point$macrocall$1$subexpression$1", "symbols": [(geometric_lexer_1.lexerAny.has("lparen") ? { type: "lparen" } : lparen), "point$macrocall$2", (geometric_lexer_1.lexerAny.has("rparen") ? { type: "rparen" } : rparen)], "postprocess": get(1) },
            { "name": "point$macrocall$1", "symbols": ["point$macrocall$1$subexpression$1"], "postprocess": unwrap },
            { "name": "point", "symbols": ["point$macrocall$1"], "postprocess": unwrap },
            { "name": "point_content", "symbols": ["number", "comma", "number"], "postprocess": x => ({ x: x[0], y: x[2] }) },
            { "name": "line", "symbols": [(geometric_lexer_1.lexerAny.has("lcurl") ? { type: "lcurl" } : lcurl), "number", "comma", "number", "comma", "number", (geometric_lexer_1.lexerAny.has("rcurl") ? { type: "rcurl" } : rcurl)], "postprocess": x => ({
                    a: x[1],
                    b: x[3],
                    c: x[5],
                }) },
            { "name": "box", "symbols": ["closed_path"], "postprocess": ([x], rej) => {
                    if (x.length !== 2) {
                        return rej;
                    }
                    return x;
                } },
            { "name": "lseg", "symbols": ["path"], "postprocess": ([x], rej) => {
                    if (x.path.length !== 2) {
                        return rej;
                    }
                    return x.path;
                } },
            { "name": "path", "symbols": ["open_path"], "postprocess": ([path]) => ({ closed: false, path }) },
            { "name": "path", "symbols": ["closed_path"], "postprocess": ([path]) => ({ closed: true, path }) },
            { "name": "open_path$macrocall$2", "symbols": [(geometric_lexer_1.lexerAny.has("lbracket") ? { type: "lbracket" } : lbracket)] },
            { "name": "open_path$macrocall$3", "symbols": [(geometric_lexer_1.lexerAny.has("rbracket") ? { type: "rbracket" } : rbracket)] },
            { "name": "open_path$macrocall$1$macrocall$2", "symbols": ["point"] },
            { "name": "open_path$macrocall$1$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "open_path$macrocall$1$macrocall$1$ebnf$1$subexpression$1", "symbols": [(geometric_lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "open_path$macrocall$1$macrocall$2"], "postprocess": last },
            { "name": "open_path$macrocall$1$macrocall$1$ebnf$1", "symbols": ["open_path$macrocall$1$macrocall$1$ebnf$1", "open_path$macrocall$1$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "open_path$macrocall$1$macrocall$1", "symbols": ["open_path$macrocall$1$macrocall$2", "open_path$macrocall$1$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "open_path$macrocall$1", "symbols": ["open_path$macrocall$2", "open_path$macrocall$1$macrocall$1", "open_path$macrocall$3"], "postprocess": get(1) },
            { "name": "open_path", "symbols": ["open_path$macrocall$1"], "postprocess": last },
            { "name": "closed_path$subexpression$1$macrocall$2", "symbols": [(geometric_lexer_1.lexerAny.has("lparen") ? { type: "lparen" } : lparen)] },
            { "name": "closed_path$subexpression$1$macrocall$3", "symbols": [(geometric_lexer_1.lexerAny.has("rparen") ? { type: "rparen" } : rparen)] },
            { "name": "closed_path$subexpression$1$macrocall$1$macrocall$2", "symbols": ["point"] },
            { "name": "closed_path$subexpression$1$macrocall$1$macrocall$1$ebnf$1", "symbols": [] },
            { "name": "closed_path$subexpression$1$macrocall$1$macrocall$1$ebnf$1$subexpression$1", "symbols": [(geometric_lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "closed_path$subexpression$1$macrocall$1$macrocall$2"], "postprocess": last },
            { "name": "closed_path$subexpression$1$macrocall$1$macrocall$1$ebnf$1", "symbols": ["closed_path$subexpression$1$macrocall$1$macrocall$1$ebnf$1", "closed_path$subexpression$1$macrocall$1$macrocall$1$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "closed_path$subexpression$1$macrocall$1$macrocall$1", "symbols": ["closed_path$subexpression$1$macrocall$1$macrocall$2", "closed_path$subexpression$1$macrocall$1$macrocall$1$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "closed_path$subexpression$1$macrocall$1", "symbols": ["closed_path$subexpression$1$macrocall$2", "closed_path$subexpression$1$macrocall$1$macrocall$1", "closed_path$subexpression$1$macrocall$3"], "postprocess": get(1) },
            { "name": "closed_path$subexpression$1", "symbols": ["closed_path$subexpression$1$macrocall$1"], "postprocess": last },
            { "name": "closed_path$subexpression$1$macrocall$5", "symbols": ["point"] },
            { "name": "closed_path$subexpression$1$macrocall$4$ebnf$1", "symbols": [] },
            { "name": "closed_path$subexpression$1$macrocall$4$ebnf$1$subexpression$1", "symbols": [(geometric_lexer_1.lexerAny.has("comma") ? { type: "comma" } : comma), "closed_path$subexpression$1$macrocall$5"], "postprocess": last },
            { "name": "closed_path$subexpression$1$macrocall$4$ebnf$1", "symbols": ["closed_path$subexpression$1$macrocall$4$ebnf$1", "closed_path$subexpression$1$macrocall$4$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "closed_path$subexpression$1$macrocall$4", "symbols": ["closed_path$subexpression$1$macrocall$5", "closed_path$subexpression$1$macrocall$4$ebnf$1"], "postprocess": ([head, tail]) => {
                    return [unwrap(head), ...(tail.map(unwrap) || [])];
                } },
            { "name": "closed_path$subexpression$1", "symbols": ["closed_path$subexpression$1$macrocall$4"], "postprocess": last },
            { "name": "closed_path", "symbols": ["closed_path$subexpression$1"], "postprocess": get(0) },
            { "name": "polygon", "symbols": ["closed_path"], "postprocess": get(0) },
            { "name": "circle_body", "symbols": ["point", "comma", "number"], "postprocess": x => ({ c: x[0], r: x[2] }) },
            { "name": "circle$subexpression$1$macrocall$2", "symbols": [(geometric_lexer_1.lexerAny.has("lcomp") ? { type: "lcomp" } : lcomp)] },
            { "name": "circle$subexpression$1$macrocall$3", "symbols": [(geometric_lexer_1.lexerAny.has("rcomp") ? { type: "rcomp" } : rcomp)] },
            { "name": "circle$subexpression$1$macrocall$1", "symbols": ["circle$subexpression$1$macrocall$2", "circle_body", "circle$subexpression$1$macrocall$3"], "postprocess": get(1) },
            { "name": "circle$subexpression$1", "symbols": ["circle$subexpression$1$macrocall$1"] },
            { "name": "circle$subexpression$1$macrocall$5", "symbols": [(geometric_lexer_1.lexerAny.has("lparen") ? { type: "lparen" } : lparen)] },
            { "name": "circle$subexpression$1$macrocall$6", "symbols": [(geometric_lexer_1.lexerAny.has("rparen") ? { type: "rparen" } : rparen)] },
            { "name": "circle$subexpression$1$macrocall$4", "symbols": ["circle$subexpression$1$macrocall$5", "circle_body", "circle$subexpression$1$macrocall$6"], "postprocess": get(1) },
            { "name": "circle$subexpression$1", "symbols": ["circle$subexpression$1$macrocall$4"] },
            { "name": "circle$subexpression$1", "symbols": ["circle_body"] },
            { "name": "circle", "symbols": ["circle$subexpression$1"], "postprocess": unwrap }
        ],
        ParserStart: "number",
    };
    exports.default = grammar;


    /***/ }),
    /* 14 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lexerAny = exports.lexer = void 0;
    const moo_1 = __webpack_require__(0);
    // build lexer
    exports.lexer = moo_1.compile({
        comma: ',',
        space: { match: /[\s\t\n\v\f\r]+/, lineBreaks: true, },
        int: /\-?\d+(?![\.\d])/,
        float: /\-?(?:(?:\d*\.\d+)|(?:\d+\.\d*))/,
        lcurl: '{',
        rcurl: '}',
        lparen: '(',
        rparen: ')',
        lbracket: '[',
        rbracket: ']',
        lcomp: '<',
        rcomp: '>',
    });
    exports.lexer.next = (next => () => {
        let tok;
        while ((tok = next.call(exports.lexer)) && (tok.type === 'space')) {
        }
        return tok;
    })(exports.lexer.next);
    exports.lexerAny = exports.lexer;


    /***/ }),
    /* 15 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    // Generated automatically by nearley, version unknown
    // http://github.com/Hardmath123/nearley
    // Bypasses TS6133. Allow declared but unused functions.
    // @ts-ignore
    function id(d) { return d[0]; }
    const interval_lexer_1 = __webpack_require__(16);
    const grammar = {
        Lexer: interval_lexer_1.lexerAny,
        ParserRules: [
            { "name": "main$ebnf$1", "symbols": ["elt"] },
            { "name": "main$ebnf$1", "symbols": ["main$ebnf$1", "elt"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main", "symbols": ["main$ebnf$1"], "postprocess": ([elts]) => {
                    // check unicity
                    const s = new Set();
                    for (const e of elts) {
                        const k = typeof e[1] === 'number'
                            ? e[0]
                            : 'time';
                        if (s.has(k)) {
                            return 'invalid';
                        }
                        s.add(k);
                    }
                    return elts;
                } },
            { "name": "elt", "symbols": ["time"] },
            { "name": "elt", "symbols": ["num", "unit"], "postprocess": ([[n], u]) => {
                    u = u[0].type;
                    return [u, n];
                } },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("years") ? { type: "years" } : years)] },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("months") ? { type: "months" } : months)] },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("days") ? { type: "days" } : days)] },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("hours") ? { type: "hours" } : hours)] },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("minutes") ? { type: "minutes" } : minutes)] },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("seconds") ? { type: "seconds" } : seconds)] },
            { "name": "unit", "symbols": [(interval_lexer_1.lexerAny.has("milliseconds") ? { type: "milliseconds" } : milliseconds)] },
            { "name": "num", "symbols": ["int"] },
            { "name": "num", "symbols": ["float"] },
            { "name": "uint", "symbols": [(interval_lexer_1.lexerAny.has("int") ? { type: "int" } : int)], "postprocess": ([x]) => parseInt(x, 10) },
            { "name": "int$ebnf$1$subexpression$1", "symbols": [(interval_lexer_1.lexerAny.has("neg") ? { type: "neg" } : neg)] },
            { "name": "int$ebnf$1", "symbols": ["int$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "int$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "int", "symbols": ["int$ebnf$1", (interval_lexer_1.lexerAny.has("int") ? { type: "int" } : int)], "postprocess": ([neg, x]) => parseInt(x, 10) * (neg ? -1 : 1) },
            { "name": "float$ebnf$1$subexpression$1", "symbols": [(interval_lexer_1.lexerAny.has("neg") ? { type: "neg" } : neg)] },
            { "name": "float$ebnf$1", "symbols": ["float$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "float$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "float$ebnf$2", "symbols": [(interval_lexer_1.lexerAny.has("int") ? { type: "int" } : int)], "postprocess": id },
            { "name": "float$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "float", "symbols": ["float$ebnf$1", "float$ebnf$2", (interval_lexer_1.lexerAny.has("dot") ? { type: "dot" } : dot), (interval_lexer_1.lexerAny.has("int") ? { type: "int" } : int)], "postprocess": ([neg, ...v]) => parseFloat(v.map(v => v ? v.text : '0').join('')) * (neg ? -1 : 1) },
            { "name": "time$ebnf$1$subexpression$1", "symbols": [(interval_lexer_1.lexerAny.has("colon") ? { type: "colon" } : colon), "uint"] },
            { "name": "time$ebnf$1", "symbols": ["time$ebnf$1$subexpression$1"], "postprocess": id },
            { "name": "time$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "time$ebnf$2$subexpression$1", "symbols": [(interval_lexer_1.lexerAny.has("dot") ? { type: "dot" } : dot), (interval_lexer_1.lexerAny.has("int") ? { type: "int" } : int)] },
            { "name": "time$ebnf$2", "symbols": ["time$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "time$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "time", "symbols": ["uint", (interval_lexer_1.lexerAny.has("colon") ? { type: "colon" } : colon), "uint", "time$ebnf$1", "time$ebnf$2"], "postprocess": ([a, _, b, c, d]) => {
                    c = c && c[1];
                    d = d && d[1];
                    const ret = typeof c === 'number' ? [
                        ['hours', a],
                        ['minutes', b],
                        ['seconds', c],
                    ] : [
                        ['minutes', a],
                        ['seconds', b],
                    ];
                    if (d) {
                        ret.push(['milliseconds', parseFloat('0.' + d) * 1000]);
                    }
                    return ret;
                } }
        ],
        ParserStart: "main",
    };
    exports.default = grammar;


    /***/ }),
    /* 16 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lexerAny = exports.lexer = void 0;
    const moo_1 = __webpack_require__(0);
    // build lexer
    exports.lexer = moo_1.compile({
        int: /\d+/,
        neg: '-',
        dot: '.',
        years: /(?:y|yrs?|years?)\b/,
        months: /(?:mon(?:th)?s?)\b/,
        days: /(?:d|days?)\b/,
        hours: /(?:h|hrs?|hours?)\b/,
        minutes: /(?:m|mins?|minutes?)\b/,
        seconds: /(?:s|secs?|seconds?)\b/,
        milliseconds: /(?:ms|milliseconds?)\b/,
        space: { match: /[\s\t\n\v\f\r]+/, lineBreaks: true, },
        colon: ':',
    });
    exports.lexer.next = (next => () => {
        let tok;
        while ((tok = next.call(exports.lexer)) && (tok.type === 'space')) {
        }
        return tok;
    })(exports.lexer.next);
    exports.lexerAny = exports.lexer;


    /***/ }),
    /* 17 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    // Generated automatically by nearley, version unknown
    // http://github.com/Hardmath123/nearley
    // Bypasses TS6133. Allow declared but unused functions.
    // @ts-ignore
    function id(d) { return d[0]; }
    const interval_iso_lexer_1 = __webpack_require__(18);
    const grammar = {
        Lexer: interval_iso_lexer_1.lexerAny,
        ParserRules: [
            { "name": "num", "symbols": [(interval_iso_lexer_1.lexerAny.has("int") ? { type: "int" } : int)] },
            { "name": "num", "symbols": [(interval_iso_lexer_1.lexerAny.has("float") ? { type: "float" } : float)] },
            { "name": "main$ebnf$1", "symbols": [] },
            { "name": "main$ebnf$1", "symbols": ["main$ebnf$1", "long"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main$ebnf$2$subexpression$1$ebnf$1", "symbols": ["short"] },
            { "name": "main$ebnf$2$subexpression$1$ebnf$1", "symbols": ["main$ebnf$2$subexpression$1$ebnf$1", "short"], "postprocess": (d) => d[0].concat([d[1]]) },
            { "name": "main$ebnf$2$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("T") ? { type: "T" } : T), "main$ebnf$2$subexpression$1$ebnf$1"] },
            { "name": "main$ebnf$2", "symbols": ["main$ebnf$2$subexpression$1"], "postprocess": id },
            { "name": "main$ebnf$2", "symbols": [], "postprocess": () => null },
            { "name": "main", "symbols": [(interval_iso_lexer_1.lexerAny.has("P") ? { type: "P" } : P), "main$ebnf$1", "main$ebnf$2"], "postprocess": ([_, a, b], rej) => {
                    b = !b ? [] : b[1];
                    if (!a.length && !b.length) {
                        return rej;
                    }
                    return !a.length ? b
                        : !b.length ? a
                            : [...a, ...b];
                } },
            { "name": "long$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("Y") ? { type: "Y" } : Y)] },
            { "name": "long$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("M") ? { type: "M" } : M)] },
            { "name": "long$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("W") ? { type: "W" } : W)] },
            { "name": "long$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("D") ? { type: "D" } : D)] },
            { "name": "long", "symbols": ["num", "long$subexpression$1"], "postprocess": ([n, u]) => {
                    n = parseFloat(n[0].value);
                    u = u[0].type;
                    switch (u) {
                        case 'Y':
                            return ['years', n];
                        case 'M':
                            return ['months', n];
                        case 'W':
                            return ['days', n * 7];
                        case 'D':
                            return ['days', n];
                        default:
                            throw new Error('Unexpected unit ' + u);
                    }
                } },
            { "name": "short$ebnf$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("T") ? { type: "T" } : T)], "postprocess": id },
            { "name": "short$ebnf$1", "symbols": [], "postprocess": () => null },
            { "name": "short$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("H") ? { type: "H" } : H)] },
            { "name": "short$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("M") ? { type: "M" } : M)] },
            { "name": "short$subexpression$1", "symbols": [(interval_iso_lexer_1.lexerAny.has("S") ? { type: "S" } : S)] },
            { "name": "short", "symbols": ["short$ebnf$1", "num", "short$subexpression$1"], "postprocess": ([_, n, u]) => {
                    n = parseFloat(n[0].value);
                    u = u[0].type;
                    switch (u) {
                        case 'H':
                            return ['hours', n];
                        case 'M':
                            return ['minutes', n];
                        case 'S':
                            return ['seconds', n];
                        default:
                            throw new Error('Unexpected unit ' + u);
                    }
                } }
        ],
        ParserStart: "num",
    };
    exports.default = grammar;


    /***/ }),
    /* 18 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lexerAny = exports.lexer = void 0;
    const moo_1 = __webpack_require__(0);
    // build lexer
    exports.lexer = moo_1.compile({
        int: /\-?\d+(?![\.\d])/,
        float: /\-?(?:(?:\d*\.\d+)|(?:\d+\.\d*))/,
        P: 'P',
        Y: 'Y',
        M: 'M',
        W: 'W',
        D: 'D',
        H: 'H',
        S: 'S',
        T: 'T',
    });
    exports.lexerAny = exports.lexer;


    /***/ }),
    /* 19 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.toSql = void 0;
    const ast_mapper_1 = __webpack_require__(2);
    const ast_visitor_1 = __webpack_require__(5);
    const utils_1 = __webpack_require__(6);
    const pg_escape_1 = __webpack_require__(20);
    const keywords_1 = __webpack_require__(3);
    const kwSet = new Set(keywords_1.sqlKeywords.map(x => x.toLowerCase()));
    let ret = [];
    function name(nm) {
        return ident(nm.name);
    }
    function ident(nm) {
        // only add quotes if has upper cases, or if it is a keyword.
        const low = nm.toLowerCase();
        if (low === nm && !kwSet.has(low) && /^[a-z][a-z0-9_]*$/.test(low)) {
            return nm;
        }
        return '"' + nm + '"';
    }
    function list(elems, act, addParen) {
        if (addParen) {
            ret.push('(');
        }
        let first = true;
        for (const e of elems) {
            if (!first) {
                ret.push(', ');
            }
            first = false;
            act(e);
        }
        if (addParen) {
            ret.push(')');
        }
    }
    function addConstraint(c, m) {
        ret.push(c.type);
        switch (c.type) {
            case 'foreign key':
                ret.push('(', ...c.localColumns.map(name).join(', '), ') REFERENCES ');
                m.tableRef(c.foreignTable);
                ret.push('(', ...c.foreignColumns.map(name).join(', '), ') ');
                if (c.match) {
                    ret.push(' MATCH ', c.match.toUpperCase());
                }
                if (c.onDelete) {
                    ret.push(' ON DELETE ', c.onDelete);
                }
                if (c.onUpdate) {
                    ret.push(' ON UPDATE ', c.onUpdate);
                }
                break;
            case 'primary key':
            case 'unique':
                if ('columns' in c) {
                    ret.push('(', ...c.columns.map(name).join(', '), ') ');
                }
                break;
            case 'check':
                m.expr(c.expr);
                break;
            case 'not null':
            case 'null':
                break;
            case 'default':
                ret.push(' DEFAULT ');
                m.expr(c.default);
                break;
            case 'add generated':
                ret.push(' GENERATED ');
                visitGenerated(m, c);
                break;
            default:
                throw utils_1.NotSupported.never(c);
        }
    }
    function visitQualifiedName(cs) {
        if (cs.schema) {
            ret.push(ident(cs.schema), '.');
        }
        ret.push(ident(cs.name), ' ');
    }
    function visitOrderBy(m, orderBy) {
        ret.push(' ORDER BY ');
        list(orderBy, e => {
            m.expr(e.by);
            if (e.order) {
                ret.push(' ', e.order);
            }
        }, false);
    }
    function visitSetVal(set) {
        switch (set.type) {
            case 'default':
                ret.push('DEFAULT ');
                break;
            case 'identifier':
                ret.push(set.name);
                break;
            case 'list':
                let first = true;
                for (const v of set.values) {
                    if (!first) {
                        ret.push(', ');
                    }
                    first = false;
                    visitSetVal(v);
                }
                break;
            case 'value':
                ret.push(typeof set.value === 'number' ? set.value.toString() : pg_escape_1.literal(set.value));
                break;
            default:
                throw utils_1.NotSupported.never(set);
        }
    }
    function visitGenerated(m, alter) {
        if (alter.always) {
            ret.push(alter.always.toUpperCase(), ' ');
        }
        ret.push('AS IDENTITY ');
        if (alter.sequence) {
            ret.push('(');
            if (alter.sequence.name) {
                ret.push('SEQUENCE NAME ');
                visitQualifiedName(alter.sequence.name);
                ret.push(' ');
            }
            visitSeqOpts(m, alter.sequence);
            ret.push(') ');
        }
    }
    function visitSeqOpts(m, cs) {
        if (cs.as) {
            ret.push('AS ');
            m.dataType(cs.as);
            ret.push(' ');
        }
        if (typeof cs.incrementBy === 'number') {
            ret.push('INCREMENT BY ', cs.incrementBy.toString(), ' ');
        }
        if (cs.minValue === 'no minvalue') {
            ret.push('NO MINVALUE ');
        }
        if (typeof cs.minValue === 'number') {
            ret.push('MINVALUE ', cs.minValue.toString(), ' ');
        }
        if (cs.maxValue === 'no maxvalue') {
            ret.push('NO MAXVALUE ');
        }
        if (typeof cs.maxValue === 'number') {
            ret.push('MAXVALUE ', cs.maxValue.toString(), ' ');
        }
        if (typeof cs.startWith === 'number') {
            ret.push('START WITH ', cs.startWith.toString(), ' ');
        }
        if (typeof cs.cache === 'number') {
            ret.push('CACHE ', cs.cache.toString(), ' ');
        }
        if (cs.cycle) {
            ret.push(cs.cycle, ' ');
        }
        if (cs.ownedBy === 'none') {
            ret.push('OWNED BY NONE ');
        }
        else if (cs.ownedBy) {
            ret.push('OWNED BY ');
            visitQColumn(cs.ownedBy);
        }
        if ('restart' in cs) {
            if (cs.restart === true) {
                ret.push('RESTART ');
            }
            else if (cs.restart) {
                ret.push('RESTART WITH ', cs.restart.toString(), ' ');
            }
        }
    }
    function visitQColumn(col) {
        if (col.schema) {
            ret.push(ident(col.schema), '.');
        }
        ret.push(ident(col.table), '.', ident(col.column), ' ');
    }
    function join(m, j, tbl) {
        if (!j) {
            tbl();
            return;
        }
        ret.push(j.type, ' ');
        tbl();
        if (j.on) {
            ret.push('ON ');
            m.expr(j.on);
        }
        if (j.using) {
            ret.push('USING (');
            list(j.using, x => ret.push(name(x)), false);
            ret.push(') ');
        }
        ret.push(' ');
    }
    function visitOp(v) {
        if (v.opSchema) {
            ret.push(' operator(', ident(v.opSchema), '.', v.op, ') ');
        }
        else {
            ret.push(' ', v.op, ' ');
        }
    }
    const visitor = ast_visitor_1.astVisitor(m => ({
        addColumn: (...args) => {
            ret.push(' ADD COLUMN ');
            if (args[0].ifNotExists) {
                ret.push('IF NOT EXISTS ');
            }
            m.super().addColumn(...args);
        },
        createExtension: e => {
            ret.push('CREATE EXTENSION ');
            if (e.ifNotExists) {
                ret.push(' IF NOT EXISTS ');
            }
            ret.push(name(e.extension));
            if (!e.from && !e.version && !e.schema) {
                return;
            }
            ret.push(' WITH');
            if (e.schema) {
                ret.push(' SCHEMA ', name(e.schema));
            }
            if (e.version) {
                ret.push(' VERSION ', pg_escape_1.literal(e.version.value));
            }
            if (e.from) {
                ret.push(' FROM ', pg_escape_1.literal(e.from.value));
            }
        },
        tablespace: t => {
            ret.push('TABLESPACE ', name(t.tablespace));
        },
        addConstraint: c => {
            ret.push(' ADD ');
            const cname = c.constraint.constraintName;
            if (cname) {
                ret.push(' CONSTRAINT ', name(cname), ' ');
            }
            addConstraint(c.constraint, m);
        },
        alterColumn: (c, t) => {
            ret.push(' ALTER COLUMN ', name(c.column), ' ');
            m.super().alterColumn(c, t);
        },
        setColumnDefault: (a, t, c) => {
            ret.push(' SET DEFAULT ');
            m.expr(a.default);
            if (a.updateExisting) {
                throw new Error('Not implemented: updateExisting on set column default');
            }
        },
        createEnum: t => {
            ret.push('CREATE TYPE ');
            visitQualifiedName(t.name);
            ret.push(' AS ENUM ');
            list(t.values, x => ret.push(pg_escape_1.literal(x.value)), true);
            ret.push(' ');
        },
        setTableOwner: o => {
            ret.push(' OWNER TO ', name(o.to));
        },
        alterColumnSimple: c => ret.push(c.type),
        alterColumnAddGenerated: (alter) => {
            ret.push(' ADD GENERATED ');
            visitGenerated(m, alter);
        },
        setColumnType: t => {
            ret.push(' SET DATA TYPE ');
            m.dataType(t.dataType);
            ret.push(' ');
        },
        alterTable: t => {
            ret.push('ALTER TABLE ');
            if (t.ifExists) {
                ret.push(' IF EXISTS ');
            }
            if (t.only) {
                ret.push(' ONLY ');
            }
            m.super().alterTable(t);
        },
        array: v => {
            ret.push(v.type === 'array' ? 'ARRAY[' : '(');
            list(v.expressions, e => m.expr(e), false);
            ret.push(v.type === 'array' ? ']' : ')');
        },
        arrayIndex: v => {
            m.expr(v.array);
            ret.push('[');
            m.expr(v.index);
            ret.push('] ');
        },
        expr: e => {
            if (e.type === 'ref') {
                m.ref(e);
                return;
            }
            // lists can become incorrect with an additional set of parentheses
            if (e.type === 'list') {
                m.super().expr(e);
                return;
            }
            // this forces to respect precedence
            // (however, it will introduce lots of unecessary parenthesis)
            ret.push('(');
            m.super().expr(e);
            ret.push(')');
        },
        callOverlay: o => {
            ret.push('OVERLAY(');
            m.expr(o.value);
            ret.push(' PLACING ');
            m.expr(o.placing);
            ret.push(' FROM ');
            m.expr(o.from);
            if (o.for) {
                ret.push(' FOR ');
                m.expr(o.for);
            }
            ret.push(')');
        },
        callSubstring: s => {
            ret.push('SUBSTRING(');
            m.expr(s.value);
            if (s.from) {
                ret.push(' FROM ');
                m.expr(s.from);
            }
            if (s.for) {
                ret.push(' FOR ');
                m.expr(s.for);
            }
            ret.push(')');
        },
        binary: v => {
            m.expr(v.left);
            visitOp(v);
            m.expr(v.right);
        },
        call: v => {
            visitQualifiedName(v.function);
            ret.push('(');
            if (v.distinct) {
                ret.push(v.distinct, ' ');
            }
            list(v.args, e => m.expr(e), false);
            if (v.orderBy) {
                visitOrderBy(m, v.orderBy);
            }
            ret.push(') ');
            if (v.filter) {
                ret.push('filter (where ');
                m.expr(v.filter);
                ret.push(') ');
            }
            if (v.over) {
                ret.push('over (');
                if (v.over.partitionBy) {
                    ret.push('PARTITION BY ');
                    list(v.over.partitionBy, x => m.expr(x), false);
                    ret.push(' ');
                }
                if (v.over.orderBy) {
                    visitOrderBy(m, v.over.orderBy);
                    ret.push(' ');
                }
                ret.push(') ');
            }
        },
        case: c => {
            ret.push('CASE ');
            if (c.value) {
                m.expr(c.value);
            }
            for (const e of c.whens) {
                ret.push(' WHEN ');
                m.expr(e.when);
                ret.push(' THEN ');
                m.expr(e.value);
            }
            if (c.else) {
                ret.push(' ELSE ');
                m.expr(c.else);
            }
            ret.push(' END ');
        },
        cast: c => {
            m.expr(c.operand);
            ret.push('::');
            m.dataType(c.to);
        },
        constant: c => {
            switch (c.type) {
                case 'boolean':
                    ret.push(c.value ? 'true' : 'false');
                    break;
                case 'integer':
                    ret.push(c.value.toString(10));
                    break;
                case 'numeric':
                    ret.push(c.value.toString());
                    if (Number.isInteger(c.value)) {
                        ret.push('.');
                    }
                    break;
                case 'null':
                    ret.push('null');
                    break;
                case 'constant':
                    break;
                case 'string':
                    ret.push(pg_escape_1.literal(c.value));
                    break;
                default:
                    throw utils_1.NotSupported.never(c);
            }
        },
        valueKeyword: v => {
            ret.push(v.keyword, ' ');
        },
        comment: c => {
            ret.push('COMMENT ON ', c.on.type.toUpperCase(), ' ');
            switch (c.on.type) {
                case 'column':
                    visitQColumn(c.on.column);
                    break;
                default:
                    visitQualifiedName(c.on.name);
                    break;
            }
            ret.push(' IS ', pg_escape_1.literal(c.comment), ' ');
        },
        extract: v => {
            ret.push('EXTRACT (', v.field.name.toUpperCase(), ' FROM ');
            m.expr(v.from);
            ret.push(') ');
        },
        createColumn: c => {
            var _a;
            ret.push(name(c.name), ' ');
            m.dataType(c.dataType);
            ret.push(' ');
            if (c.collate) {
                ret.push('COLLATE ');
                visitQualifiedName(c.collate);
            }
            for (const cst of (_a = c.constraints) !== null && _a !== void 0 ? _a : []) {
                m.constraint(cst);
            }
        },
        begin: beg => {
            ret.push('BEGIN ');
            if (beg.isolationLevel) {
                ret.push('ISOLATION LEVEL ', beg.isolationLevel.toUpperCase(), ' ');
            }
            if (beg.writeable) {
                ret.push(beg.writeable.toUpperCase(), ' ');
            }
            if (typeof beg.deferrable === 'boolean') {
                if (!beg.deferrable) {
                    ret.push('NOT ');
                }
                ret.push('DEFERRABLE ');
            }
        },
        alterSequence: cs => {
            ret.push('ALTER SEQUENCE ');
            if (cs.ifExists) {
                ret.push('IF EXISTS ');
            }
            visitQualifiedName(cs.name);
            switch (cs.change.type) {
                case 'set options':
                    visitSeqOpts(m, cs.change);
                    break;
                case 'rename':
                    ret.push('RENAME TO ', name(cs.change.newName), ' ');
                    break;
                case 'set schema':
                    ret.push('SET SCHEMA ', name(cs.change.newSchema), ' ');
                    break;
                case 'owner to':
                    cs.change.owner;
                    ret.push('OWNER TO ', name(cs.change.owner), ' ');
                    break;
                default:
                    throw utils_1.NotSupported.never(cs.change);
            }
        },
        createSequence: cs => {
            ret.push('CREATE ');
            if (cs.temp) {
                ret.push('TEMPORARY ');
            }
            ret.push('SEQUENCE ');
            if (cs.ifNotExists) {
                ret.push('IF NOT EXISTS ');
            }
            visitQualifiedName(cs.name);
            visitSeqOpts(m, cs.options);
        },
        dropTable: val => {
            ret.push('DROP TABLE ');
            if (val.ifExists) {
                ret.push('IF EXISTS ');
            }
            m.tableRef(val.name);
        },
        dropIndex: val => {
            ret.push('DROP INDEX ');
            if (val.concurrently) {
                ret.push('CONCURRENTLY ');
            }
            if (val.ifExists) {
                ret.push('IF EXISTS ');
            }
            m.tableRef(val.name);
        },
        dropSequence: val => {
            ret.push('DROP SEQUENCE ');
            if (val.ifExists) {
                ret.push('IF EXISTS ');
            }
            m.tableRef(val.name);
        },
        constraint: cst => {
            if (cst.constraintName) {
                ret.push(' CONSTRAINT ', name(cst.constraintName), ' ');
            }
            switch (cst.type) {
                case 'not null':
                case 'null':
                case 'primary key':
                case 'unique':
                    ret.push(' ', cst.type, ' ');
                    return;
                case 'default':
                    ret.push(' DEFAULT ');
                    m.expr(cst.default);
                    break;
                case 'check':
                    ret.push(' CHECK ');
                    m.expr(cst.expr);
                    break;
                case 'add generated':
                    ret.push(' GENERATED ');
                    visitGenerated(m, cst);
                    break;
                default:
                    throw utils_1.NotSupported.never(cst);
            }
        },
        do: d => {
            ret.push('DO');
            if (d.language) {
                ret.push(' LANGUAGE ', d.language.name);
            }
            ret.push(' $$', d.code, '$$');
        },
        createFunction: c => {
            ret.push(c.orReplace ? 'CREATE OR REPLACE FUNCTION ' : 'CREATE FUNCTION ');
            visitQualifiedName(c.name);
            // args
            list(c.arguments, a => {
                if (a.mode) {
                    ret.push(a.mode, ' ');
                }
                if (a.name) {
                    ret.push(name(a.name), ' ');
                }
                m.dataType(a.type);
            }, true);
            // ret type
            if (c.returns) {
                switch (c.returns.kind) {
                    case 'table':
                        ret.push(' RETURNS TABLE ');
                        list(c.returns.columns, t => {
                            ret.push(name(t.name), ' ');
                            m.dataType(t.type);
                        }, true);
                        break;
                    case undefined:
                    case null:
                    case 'array':
                        ret.push(' RETURNS ');
                        m.dataType(c.returns);
                        break;
                    default:
                        throw utils_1.NotSupported.never(c.returns);
                }
            }
            ret.push(' AS $$', c.code, '$$');
            // function settings
            if (c.language) {
                ret.push('LANGUAGE ', c.language.name, ' ');
            }
            if (c.purity) {
                ret.push(c.purity.toUpperCase(), ' ');
            }
            if (typeof c.leakproof === 'boolean') {
                ret.push(c.leakproof ? 'LEAKPROOF ' : 'NOT LEAKPROOF ');
            }
            switch (c.onNullInput) {
                case 'call':
                    ret.push('CALLED ON NULL INPUT ');
                    break;
                case 'null':
                    ret.push('RETURNS NULL ON NULL INPUT ');
                    break;
                case 'strict':
                    ret.push('STRICT ');
                    break;
                case null:
                case undefined:
                    break;
                default:
                    throw utils_1.NotSupported.never(c.onNullInput);
            }
        },
        with: w => {
            ret.push('WITH ');
            list(w.bind, b => {
                ret.push(name(b.alias), ' AS (');
                m.statement(b.statement);
                ret.push(') ');
            }, false);
            m.statement(w.in);
        },
        withRecursive: val => {
            ret.push('WITH RECURSIVE ', name(val.alias), '(', ...val.columnNames.map(name).join(', '), ') AS (');
            m.union(val.bind);
            ret.push(') ');
            m.statement(val.in);
        },
        setGlobal: g => {
            ret.push('SET ', name(g.variable), ' = ');
            visitSetVal(g.set);
        },
        setTimezone: g => {
            ret.push('SET TIME ZONE ');
            switch (g.to.type) {
                case 'default':
                case 'local':
                    ret.push(g.to.type.toUpperCase(), ' ');
                    break;
                case 'value':
                    ret.push(typeof g.to.value === 'string'
                        ? pg_escape_1.literal(g.to.value)
                        : g.to.value.toString(10));
                    break;
                case 'interval':
                    ret.push('INTERVAL ', pg_escape_1.literal(g.to.value), ' HOUR TO MINUTE');
                    break;
                default:
                    throw utils_1.NotSupported.never(g.to);
            }
        },
        dataType: d => {
            var _a;
            if ((d === null || d === void 0 ? void 0 : d.kind) === 'array') {
                m.dataType(d.arrayOf);
                ret.push('[]');
                return;
            }
            if (!(d === null || d === void 0 ? void 0 : d.name)) {
                ret.push('unkown');
                return;
            }
            if (d.schema) {
                visitQualifiedName(d);
            }
            else {
                // see https://www.postgresql.org/docs/13/datatype.html
                // & issue https://github.com/oguimbal/pgsql-ast-parser/issues/38
                switch (d.name) {
                    case 'double precision':
                    case 'character varying':
                    case 'bit varying':
                    case 'time without time zone':
                    case 'timestamp without time zone':
                    case 'time with time zone':
                    case 'timestamp with time zone':
                        ret.push(d.name, ' ');
                        break;
                    default:
                        visitQualifiedName(d);
                        break;
                }
            }
            if ((_a = d.config) === null || _a === void 0 ? void 0 : _a.length) {
                list(d.config, v => ret.push(v.toString(10)), true);
            }
        },
        createIndex: c => {
            ret.push(c.unique ? 'CREATE UNIQUE INDEX ' : 'CREATE INDEX ');
            if (c.ifNotExists) {
                ret.push(' IF NOT EXISTS ');
            }
            if (c.indexName) {
                ret.push(name(c.indexName), ' ');
            }
            ret.push('ON ');
            m.tableRef(c.table);
            if (c.using) {
                ret.push('USING ', name(c.using), ' ');
            }
            list(c.expressions, e => {
                m.expr(e.expression);
                ret.push(' ');
                if (e.collate) {
                    ret.push('COLLATE ');
                    visitQualifiedName(e.collate);
                }
                if (e.opclass) {
                    visitQualifiedName(e.opclass);
                }
                if (e.order) {
                    ret.push(e.order, ' ');
                }
                if (e.nulls) {
                    ret.push('nulls ', e.nulls, ' ');
                }
            }, true);
            ret.push(' ');
        },
        createTable: t => {
            var _a;
            ret.push('CREATE ');
            if (t.locality) {
                ret.push(t.locality.toUpperCase(), ' ');
            }
            if (t.temporary) {
                ret.push('TEMPORARY ');
            }
            if (t.unlogged) {
                ret.push('UNLOGGED ');
            }
            ret.push(t.ifNotExists ? 'TABLE IF NOT EXISTS ' : 'TABLE ');
            m.tableRef(t.name);
            ret.push('(');
            list(t.columns, c => {
                switch (c.kind) {
                    case 'column':
                        return m.createColumn(c);
                    case 'like table':
                        return m.likeTable(c);
                    default:
                        throw utils_1.NotSupported.never(c);
                }
            }, false);
            if (t.constraints) {
                ret.push(', ');
                list(t.constraints, c => {
                    const cname = c.constraintName;
                    if (cname) {
                        ret.push('CONSTRAINT ', name(cname), ' ');
                    }
                    addConstraint(c, m);
                }, false);
            }
            ret.push(') ');
            if ((_a = t.inherits) === null || _a === void 0 ? void 0 : _a.length) {
                ret.push(' INHERITS ');
                list(t.inherits, i => visitQualifiedName(i), true);
            }
        },
        likeTable: l => {
            ret.push(' LIKE ');
            m.tableRef(l.like);
            ret.push(' ');
            for (const { verb, option } of l.options) {
                ret.push(verb.toUpperCase(), ' ', option.toUpperCase(), ' ');
            }
        },
        createSchema: s => {
            ret.push(s.ifNotExists ? 'CREATE SCHEMA IF NOT EXISTS ' : 'CREATE SCHEMA ');
            ret.push(name(s.name));
        },
        truncateTable: t => {
            ret.push('TRUNCATE TABLE ');
            let first = true;
            for (const tbl of t.tables) {
                if (!first) {
                    ret.push(', ');
                }
                first = false;
                m.tableRef(tbl);
            }
            if (t.identity) {
                switch (t.identity) {
                    case 'restart':
                        ret.push(' RESTART IDENTITY ');
                        break;
                    case 'continue':
                        ret.push(' CONTINUE IDENTITY ');
                        break;
                }
            }
        },
        delete: t => {
            ret.push('DELETE FROM ');
            m.tableRef(t.from);
            if (t.where) {
                ret.push(' WHERE ');
                m.expr(t.where);
            }
            if (t.returning) {
                ret.push(' RETURNING ');
                list(t.returning, r => m.selectionColumn(r), false);
            }
            ret.push(' ');
        },
        dropColumn: t => {
            ret.push(' DROP COLUMN ');
            if (t.ifExists) {
                ret.push(' IF EXISTS ');
            }
            ret.push(name(t.column));
        },
        from: t => m.super().from(t),
        fromCall: s => {
            join(m, s.join, () => {
                m.call(s);
                if (s.alias) {
                    ret.push(' AS ', name(s.alias), ' ');
                }
            });
            ret.push(' ');
        },
        fromStatement: s => {
            // todo: use 's.db' if defined
            join(m, s.join, () => {
                ret.push('(');
                m.select(s.statement);
                ret.push(') ');
                if (s.alias) {
                    ret.push(' AS ', ident(s.alias));
                    if (s.columnNames) {
                        list(s.columnNames, c => ret.push(name(c)), true);
                    }
                    ret.push(' ');
                }
            });
            ret.push(' ');
        },
        values: s => {
            ret.push('VALUES ');
            list(s.values, vlist => {
                list(vlist, e => {
                    m.expr(e);
                }, true);
            }, false);
        },
        fromTable: s => {
            join(m, s.join, () => {
                m.tableRef(s.name);
                if (s.name.columnNames) {
                    if (!s.name.alias) {
                        throw new Error('Cannot specify aliased column names without an alias');
                    }
                    list(s.name.columnNames, c => ret.push(name(c)), true);
                }
            });
        },
        join: j => {
            throw new Error('Should not happen 💀');
        },
        insert: i => {
            ret.push('INSERT INTO ');
            m.tableRef(i.into);
            if (i.columns) {
                ret.push('(', i.columns.map(name).join(', '), ')');
            }
            ret.push(' ');
            if (i.overriding) {
                ret.push('OVERRIDING ', i.overriding.toUpperCase(), ' VALUE ');
            }
            m.select(i.insert);
            ret.push(' ');
            if (i.onConflict) {
                ret.push('ON CONFLICT ');
                if (i.onConflict.on) {
                    list(i.onConflict.on, e => m.expr(e), true);
                }
                if (i.onConflict.do === 'do nothing') {
                    ret.push(' DO NOTHING');
                }
                else {
                    ret.push(' DO UPDATE SET ');
                    list(i.onConflict.do.sets, s => m.set(s), false);
                }
                ret.push(' ');
            }
            if (i.returning) {
                ret.push(' RETURNING ');
                list(i.returning, r => m.selectionColumn(r), false);
            }
        },
        raise: r => {
            var _a, _b;
            ret.push('RAISE ');
            if (r.level) {
                ret.push(r.level.toUpperCase(), ' ');
            }
            ret.push(pg_escape_1.literal(r.format), ' ');
            if ((_a = r.formatExprs) === null || _a === void 0 ? void 0 : _a.length) {
                ret.push(', ');
                list(r.formatExprs, e => m.expr(e), false);
            }
            if ((_b = r.using) === null || _b === void 0 ? void 0 : _b.length) {
                ret.push(' USING ');
                list(r.using, ({ type, value }) => {
                    ret.push(type.toUpperCase(), '=');
                    m.expr(value);
                }, false);
            }
            ret.push(' ');
        },
        default: () => {
            ret.push(' DEFAULT ');
        },
        member: e => {
            m.expr(e.operand);
            ret.push(e.op);
            ret.push(typeof e.member === 'number'
                ? e.member.toString(10)
                : pg_escape_1.literal(e.member));
        },
        ref: r => {
            if (r.table) {
                visitQualifiedName(r.table);
                ret.push('.');
            }
            ret.push(r.name === '*' ? '*' : ident(r.name));
        },
        parameter: p => {
            ret.push(p.name);
        },
        renameColumn: r => {
            ret.push(' RENAME COLUMN ', name(r.column), ' TO ', name(r.to));
        },
        renameConstraint: r => {
            ret.push(' RENAME CONSTRAINT ', name(r.constraint), ' TO ', name(r.to));
        },
        renameTable: r => {
            ret.push(' RENAME TO ', name(r.to));
        },
        createView: c => {
            ret.push('CREATE ');
            if (c.orReplace) {
                ret.push('OR REPLACE ');
            }
            if (c.temp) {
                ret.push('TEMP ');
            }
            if (c.recursive) {
                ret.push('RECURSIVE ');
            }
            ret.push('VIEW ');
            m.tableRef(c.name);
            if (c.columnNames) {
                list(c.columnNames, c => ret.push(name(c)), true);
            }
            const opts = c.parameters && Object.entries(c.parameters);
            if (opts === null || opts === void 0 ? void 0 : opts.length) {
                ret.push(' WITH ');
                list(opts, ([k, v]) => ret.push(k, '=', v), false);
            }
            ret.push(' AS ');
            m.select(c.query);
            if (c.checkOption) {
                ret.push(' WITH ', c.checkOption.toUpperCase(), ' CHECK OPTION');
            }
        },
        createMaterializedView: c => {
            ret.push('CREATE MATERIALIZED VIEW ');
            if (c.ifNotExists) {
                ret.push('IF NOT EXISTS ');
            }
            m.tableRef(c.name);
            if (c.columnNames) {
                list(c.columnNames, c => ret.push(name(c)), true);
            }
            const opts = c.parameters && Object.entries(c.parameters);
            if (opts === null || opts === void 0 ? void 0 : opts.length) {
                ret.push(' WITH ');
                list(opts, ([k, v]) => ret.push(k, '=', v), false);
            }
            if (c.tablespace) {
                ret.push(' TABLESPACE ', name(c.tablespace));
            }
            ret.push(' AS ');
            m.select(c.query);
            if (typeof c.withData === 'boolean') {
                ret.push(c.withData ? ' WITH DATA' : ' WITH NO DATA');
            }
        },
        select: s => m.super().select(s),
        selection: s => {
            ret.push('SELECT ');
            if (s.distinct) {
                if (typeof s.distinct === 'string') {
                    ret.push(s.distinct.toUpperCase());
                }
                else {
                    ret.push(' DISTINCT ON ');
                    list(s.distinct, v => m.expr(v), true);
                }
                ret.push(' ');
            }
            if (s.columns) {
                list(s.columns, c => m.selectionColumn(c), false);
            }
            ret.push(' ');
            if (s.from) {
                ret.push('FROM ');
                for (const f of s.from) {
                    m.from(f);
                }
                ret.push(' ');
            }
            if (s.where) {
                ret.push('WHERE ');
                m.expr(s.where);
                ret.push(' ');
            }
            if (s.groupBy) {
                ret.push('GROUP BY ');
                list(s.groupBy, e => m.expr(e), false);
                ret.push(' ');
            }
            if (s.orderBy) {
                visitOrderBy(m, s.orderBy);
                ret.push(' ');
            }
            if (s.limit) {
                if (s.limit.offset) {
                    ret.push(`OFFSET `);
                    m.expr(s.limit.offset);
                    if (s.limit.limit) {
                        ret.push(`FETCH `);
                        m.expr(s.limit.limit);
                    }
                }
                else if (s.limit.limit) {
                    ret.push(`LIMIT `);
                    m.expr(s.limit.limit);
                }
            }
        },
        show: s => {
            ret.push('SHOW ', name(s.variable));
        },
        prepare: s => {
            var _a;
            ret.push('PREPARE ', name(s.name));
            if ((_a = s.args) === null || _a === void 0 ? void 0 : _a.length) {
                list(s.args, a => m.dataType(a), true);
            }
            ret.push(' AS ');
            m.statement(s.statement);
        },
        arraySelect: s => {
            ret.push('array(');
            m.select(s.select);
            ret.push(')');
        },
        union: s => {
            ret.push('(');
            m.statement(s.left);
            ret.push(') ', s.type.toUpperCase(), ' ');
            if (s.right.type === 'union' || s.right.type === 'union all') {
                m.union(s.right);
            }
            else {
                ret.push('(');
                m.statement(s.right);
                ret.push(')');
            }
        },
        selectionColumn: c => {
            m.expr(c.expr);
            if (c.alias) {
                ret.push(' AS ', name(c.alias));
            }
            ret.push(' ');
        },
        set: s => {
            ret.push(name(s.column), ' = ');
            if (s.value === 'default') {
                ret.push('default');
            }
            else {
                m.expr(s.value);
            }
            ret.push(' ');
        },
        statement: s => m.super().statement(s),
        tableRef: r => {
            visitQualifiedName(r);
            if (r.alias) {
                ret.push(' AS ', ident(r.alias));
            }
            ret.push(' ');
        },
        ternary: t => {
            m.expr(t.value);
            ret.push(' ', t.op, ' ');
            m.expr(t.lo);
            ret.push(' AND ');
            m.expr(t.hi);
            ret.push(' ');
        },
        transaction: t => {
            ret.push(t.type);
        },
        unary: t => {
            switch (t.op) {
                case '+':
                case '-':
                    // prefix ops
                    visitOp(t);
                    m.expr(t.operand);
                    break;
                case 'NOT':
                    // prefix ops
                    ret.push(t.op);
                    ret.push(' ');
                    m.expr(t.operand);
                    break;
                default:
                    // postfix ops
                    m.expr(t.operand);
                    ret.push(' ');
                    ret.push(t.op);
            }
        },
        update: u => {
            ret.push('UPDATE ');
            m.tableRef(u.table);
            ret.push(' SET ');
            list(u.sets, s => m.set(s), false);
            ret.push(' ');
            if (u.where) {
                ret.push('WHERE ');
                m.expr(u.where);
                ret.push(' ');
            }
            if (u.returning) {
                ret.push(' RETURNING ');
                list(u.returning, r => m.selectionColumn(r), false);
                ret.push(' ');
            }
        },
    }));
    exports.toSql = {};
    const proto = ast_mapper_1.AstDefaultMapper.prototype;
    for (const k of Object.getOwnPropertyNames(proto)) {
        const orig = proto[k];
        if (k === 'constructor' || k === 'super' || typeof orig !== 'function') {
            continue;
        }
        exports.toSql[k] = function (...args) {
            try {
                visitor[k].apply(visitor, args);
                return ret.join('').trim();
            }
            finally {
                ret = [];
            }
        };
    }


    /***/ }),
    /* 20 */
    /***/ (function(module, exports, __webpack_require__) {

    // stolen from https://github.com/segmentio/pg-escape/blob/master/index.js
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.literal = void 0;
    function literal(val) {
        if (null == val)
            return 'NULL';
        if (Array.isArray(val)) {
            var vals = val.map(literal);
            return "(" + vals.join(", ") + ")";
        }
        var backslash = ~val.indexOf('\\');
        var prefix = backslash ? 'E' : '';
        val = val.replace(/'/g, "''");
        val = val.replace(/\\/g, '\\\\');
        return prefix + "'" + val + "'";
    }
    exports.literal = literal;


    /***/ }),
    /* 21 */
    /***/ (function(module, exports, __webpack_require__) {

    Object.defineProperty(exports, "__esModule", { value: true });
    exports.locationOf = void 0;
    function locationOf(node) {
        const n = node._location;
        if (!n) {
            throw new Error('This statement has not been parsed using location tracking (which has a small performance hit). ');
        }
        return n;
    }
    exports.locationOf = locationOf;


    /***/ })
    /******/ ])));

    });

    var postgres = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PostgreSQLParser = void 0;

    class PostgreSQLParser {
        constructor() { }
        // Auto Increment에 해당하는 타입인지 체크
        // postgres의 경우에는 시퀀스를 자동 생성해주는 타입
        checkAutoIncrement(typename) {
            return ["serial", "serial8", "bigserial"].includes(typename.toLowerCase());
        }
        // 데이터베이스 타입 일반화
        normalizeDbType(typename) {
            if (typename.toLowerCase() === "serial") {
                return "int";
            }
            else if (["serial8", "bigserial"].includes(typename.toLowerCase())) {
                return "int8";
            }
            else {
                return typename;
            }
        }
        // 데이터베이스의 컬럼타입을 타입스크립트 타입으로 변환
        convertDbTypeToTsType(typename) {
            if (["text", "varchar"].includes(typename.toLocaleLowerCase())) {
                return "string";
            }
            else if (["bool", "boolean"].includes(typename.toLocaleLowerCase())) {
                return "boolean";
            }
            else if (["int", "int2", "int4", "int8", "bigint"].includes(typename.toLocaleLowerCase())) {
                return "number";
            }
            else if (["timestamp", "timestamptz", "date"].includes(typename.toLocaleLowerCase())) {
                return "Date";
            }
            else if (typename[0] === "_") {
                return this.convertDbTypeToTsType(typename.slice(1)) + "[]";
            }
            else {
                return "string";
            }
        }
        // 파싱
        parse(sql) {
            var _a, _b;
            const parsedList = pgsqlAstParser.parse(sql);
            const tables = [];
            for (const node of parsedList) {
                switch (node.type) {
                    case "create table":
                        tables.push(this.parseTable(node));
                        break;
                    case "comment":
                        this.parseComment(node, tables);
                        break;
                    case "alter table":
                        if (((_b = (_a = node === null || node === void 0 ? void 0 : node.change) === null || _a === void 0 ? void 0 : _a.constraint) === null || _b === void 0 ? void 0 : _b.type) ===
                            "primary key") {
                            this.parsePrimaryKey(node, tables);
                        }
                        break;
                    default:
                        console.log("예외 케이스");
                        console.log(node);
                        break;
                }
            }
            return tables;
        }
        // 테이블 구성 분석
        parseTable(node) {
            var _a, _b, _c, _d;
            const table = {
                tableName: (_a = node === null || node === void 0 ? void 0 : node.name) === null || _a === void 0 ? void 0 : _a.name,
                columns: [],
            };
            for (const nodeOfTable of node.columns) {
                switch (nodeOfTable.kind) {
                    case "column":
                        const columnName = (_b = nodeOfTable === null || nodeOfTable === void 0 ? void 0 : nodeOfTable.name) === null || _b === void 0 ? void 0 : _b.name;
                        const dbType = (_c = nodeOfTable === null || nodeOfTable === void 0 ? void 0 : nodeOfTable.dataType) === null || _c === void 0 ? void 0 : _c.name;
                        const normalizedDbType = this.normalizeDbType(dbType);
                        const isAutoIncrement = this.checkAutoIncrement(dbType);
                        let isNotNull = false;
                        let isPrimaryKey = false;
                        let defaultValue = null;
                        for (const nodeOfConstraints of nodeOfTable === null || nodeOfTable === void 0 ? void 0 : nodeOfTable.constraints) {
                            switch (nodeOfConstraints.type) {
                                case "not null":
                                    isNotNull = true;
                                    break;
                                case "default":
                                    defaultValue = (_d = nodeOfConstraints === null || nodeOfConstraints === void 0 ? void 0 : nodeOfConstraints.default) === null || _d === void 0 ? void 0 : _d.keyword;
                            }
                        }
                        const column = {
                            name: columnName,
                            dbType: normalizedDbType,
                            tsType: this.convertDbTypeToTsType(normalizedDbType),
                            isNotNull,
                            isPrimaryKey,
                            default: defaultValue,
                            isAutoIncrement,
                            comment: "",
                        };
                        table.columns.push(column);
                        break;
                }
            }
            return table;
        }
        // 코멘트 분석
        parseComment(node, tables) {
            var _a, _b, _c, _d, _e, _f;
            const commentContents = node === null || node === void 0 ? void 0 : node.comment;
            const commentTargetTableName = (_b = (_a = node === null || node === void 0 ? void 0 : node.on) === null || _a === void 0 ? void 0 : _a.column) === null || _b === void 0 ? void 0 : _b.table;
            const commentTargetColumnName = (_d = (_c = node === null || node === void 0 ? void 0 : node.on) === null || _c === void 0 ? void 0 : _c.column) === null || _d === void 0 ? void 0 : _d.column;
            const commenttargetColumn = (_f = (_e = tables
                .find((e) => e.tableName === commentTargetTableName)) === null || _e === void 0 ? void 0 : _e.columns) === null || _f === void 0 ? void 0 : _f.find((e) => e.name === commentTargetColumnName);
            if (commenttargetColumn) {
                commenttargetColumn.comment = commentContents;
            }
        }
        // 기본키 분석
        parsePrimaryKey(node, tables) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const pkTargetColumnNames = (_c = (_b = (_a = node === null || node === void 0 ? void 0 : node.change) === null || _a === void 0 ? void 0 : _a.constraint) === null || _b === void 0 ? void 0 : _b.columns) === null || _c === void 0 ? void 0 : _c.map((e) => e === null || e === void 0 ? void 0 : e.name);
            const pkTargetTableName = (_d = node === null || node === void 0 ? void 0 : node.table) === null || _d === void 0 ? void 0 : _d.name;
            // not use
            (_g = (_f = (_e = node === null || node === void 0 ? void 0 : node.change) === null || _e === void 0 ? void 0 : _e.constraint) === null || _f === void 0 ? void 0 : _f.constraintName) === null || _g === void 0 ? void 0 : _g.name;
            (_j = (_h = tables
                .find((e) => e.tableName === pkTargetTableName)) === null || _h === void 0 ? void 0 : _h.columns) === null || _j === void 0 ? void 0 : _j.forEach((e) => {
                if (pkTargetColumnNames.includes(e.name)) {
                    e.isPrimaryKey = true;
                }
            });
        }
    }
    exports.PostgreSQLParser = PostgreSQLParser;

    });

    var strings = createCommonjsModule(function (module, exports) {
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.levenshtein = exports.capitalize = exports.underscore = exports.classify = exports.camelize = exports.dasherize = exports.decamelize = void 0;
    const STRING_DASHERIZE_REGEXP = /[ _]/g;
    const STRING_DECAMELIZE_REGEXP = /([a-z\d])([A-Z])/g;
    const STRING_CAMELIZE_REGEXP = /(-|_|\.|\s)+(.)?/g;
    const STRING_UNDERSCORE_REGEXP_1 = /([a-z\d])([A-Z]+)/g;
    const STRING_UNDERSCORE_REGEXP_2 = /-|\s+/g;
    /**
     * Converts a camelized string into all lower case separated by underscores.
     *
     ```javascript
     decamelize('innerHTML');         // 'inner_html'
     decamelize('action_name');       // 'action_name'
     decamelize('css-class-name');    // 'css-class-name'
     decamelize('my favorite items'); // 'my favorite items'
     ```

     @method decamelize
     @param {String} str The string to decamelize.
     @return {String} the decamelized string.
     */
    function decamelize(str) {
        return str.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();
    }
    exports.decamelize = decamelize;
    /**
     Replaces underscores, spaces, or camelCase with dashes.

     ```javascript
     dasherize('innerHTML');         // 'inner-html'
     dasherize('action_name');       // 'action-name'
     dasherize('css-class-name');    // 'css-class-name'
     dasherize('my favorite items'); // 'my-favorite-items'
     ```

     @method dasherize
     @param {String} str The string to dasherize.
     @return {String} the dasherized string.
     */
    function dasherize(str) {
        return decamelize(str).replace(STRING_DASHERIZE_REGEXP, '-');
    }
    exports.dasherize = dasherize;
    /**
     Returns the lowerCamelCase form of a string.

     ```javascript
     camelize('innerHTML');          // 'innerHTML'
     camelize('action_name');        // 'actionName'
     camelize('css-class-name');     // 'cssClassName'
     camelize('my favorite items');  // 'myFavoriteItems'
     camelize('My Favorite Items');  // 'myFavoriteItems'
     ```

     @method camelize
     @param {String} str The string to camelize.
     @return {String} the camelized string.
     */
    function camelize(str) {
        return str
            .replace(STRING_CAMELIZE_REGEXP, (_match, _separator, chr) => {
            return chr ? chr.toUpperCase() : '';
        })
            .replace(/^([A-Z])/, (match) => match.toLowerCase());
    }
    exports.camelize = camelize;
    /**
     Returns the UpperCamelCase form of a string.

     ```javascript
     'innerHTML'.classify();          // 'InnerHTML'
     'action_name'.classify();        // 'ActionName'
     'css-class-name'.classify();     // 'CssClassName'
     'my favorite items'.classify();  // 'MyFavoriteItems'
     ```

     @method classify
     @param {String} str the string to classify
     @return {String} the classified string
     */
    function classify(str) {
        return str
            .split('.')
            .map((part) => capitalize(camelize(part)))
            .join('.');
    }
    exports.classify = classify;
    /**
     More general than decamelize. Returns the lower\_case\_and\_underscored
     form of a string.

     ```javascript
     'innerHTML'.underscore();          // 'inner_html'
     'action_name'.underscore();        // 'action_name'
     'css-class-name'.underscore();     // 'css_class_name'
     'my favorite items'.underscore();  // 'my_favorite_items'
     ```

     @method underscore
     @param {String} str The string to underscore.
     @return {String} the underscored string.
     */
    function underscore(str) {
        return str
            .replace(STRING_UNDERSCORE_REGEXP_1, '$1_$2')
            .replace(STRING_UNDERSCORE_REGEXP_2, '_')
            .toLowerCase();
    }
    exports.underscore = underscore;
    /**
     Returns the Capitalized form of a string

     ```javascript
     'innerHTML'.capitalize()         // 'InnerHTML'
     'action_name'.capitalize()       // 'Action_name'
     'css-class-name'.capitalize()    // 'Css-class-name'
     'my favorite items'.capitalize() // 'My favorite items'
     ```

     @method capitalize
     @param {String} str The string to capitalize.
     @return {String} The capitalized string.
     */
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.substr(1);
    }
    exports.capitalize = capitalize;
    /**
     * Calculate the levenshtein distance of two strings.
     * See https://en.wikipedia.org/wiki/Levenshtein_distance.
     * Based off https://gist.github.com/andrei-m/982927 (for using the faster dynamic programming
     * version).
     *
     * @param a String a.
     * @param b String b.
     * @returns A number that represents the distance between the two strings. The greater the number
     *   the more distant the strings are from each others.
     */
    function levenshtein(a, b) {
        if (a.length == 0) {
            return b.length;
        }
        if (b.length == 0) {
            return a.length;
        }
        const matrix = [];
        // increment along the first column of each row
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        // increment each column in the first row
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        // Fill in the rest of the matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }
    exports.levenshtein = levenshtein;
    });

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    /**
     * Source: ftp://ftp.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
     */
    /**
     * Lower case as a function.
     */
    function lowerCase(str) {
        return str.toLowerCase();
    }

    // Support camel case ("camelCase" -> "camel Case" and "CAMELCase" -> "CAMEL Case").
    var DEFAULT_SPLIT_REGEXP = [/([a-z0-9])([A-Z])/g, /([A-Z])([A-Z][a-z])/g];
    // Remove all non-word characters.
    var DEFAULT_STRIP_REGEXP = /[^A-Z0-9]+/gi;
    /**
     * Normalize the string into something other libraries can manipulate easier.
     */
    function noCase(input, options) {
        if (options === void 0) { options = {}; }
        var _a = options.splitRegexp, splitRegexp = _a === void 0 ? DEFAULT_SPLIT_REGEXP : _a, _b = options.stripRegexp, stripRegexp = _b === void 0 ? DEFAULT_STRIP_REGEXP : _b, _c = options.transform, transform = _c === void 0 ? lowerCase : _c, _d = options.delimiter, delimiter = _d === void 0 ? " " : _d;
        var result = replace(replace(input, splitRegexp, "$1\0$2"), stripRegexp, "\0");
        var start = 0;
        var end = result.length;
        // Trim the delimiter from around the output string.
        while (result.charAt(start) === "\0")
            start++;
        while (result.charAt(end - 1) === "\0")
            end--;
        // Transform each token independently.
        return result.slice(start, end).split("\0").map(transform).join(delimiter);
    }
    /**
     * Replace `re` in the input string with the replacement value.
     */
    function replace(input, re, value) {
        if (re instanceof RegExp)
            return input.replace(re, value);
        return re.reduce(function (input, re) { return input.replace(re, value); }, input);
    }

    function dotCase(input, options) {
        if (options === void 0) { options = {}; }
        return noCase(input, __assign({ delimiter: "." }, options));
    }

    function snakeCase(input, options) {
        if (options === void 0) { options = {}; }
        return dotCase(input, __assign({ delimiter: "_" }, options));
    }

    var dist_es2015 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        snakeCase: snakeCase
    });

    var snake_case_1 = /*@__PURE__*/getAugmentedNamespace(dist_es2015);

    var name = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.convertNameCaseByOption = exports.toSnakeCase = exports.toCamelCase = exports.toPascalCase = void 0;


    const lowercased = (name) => {
        const classifiedName = strings.classify(name);
        return classifiedName.charAt(0).toLowerCase() + classifiedName.slice(1);
    };
    // 식별자를 파스칼케이스로 변환
    function toPascalCase(name) {
        const f = strings.classify(name);
        console.log(f);
        return f;
    }
    exports.toPascalCase = toPascalCase;
    // 식별자를 카멜케이스로 변환
    function toCamelCase(name) {
        return lowercased(name);
    }
    exports.toCamelCase = toCamelCase;
    // 식별자를 스네이크케이스로 변환
    function toSnakeCase(name) {
        return snake_case_1.snakeCase(name);
    }
    exports.toSnakeCase = toSnakeCase;
    function convertNameCaseByOption(option, name) {
        switch (option) {
            case "CAMEL":
                return toCamelCase(name);
            case "SNAKE":
                return toSnakeCase(name);
            case "PASCAL":
                return toPascalCase(name);
            case "NONE":
                return name;
            default:
                return name;
        }
    }
    exports.convertNameCaseByOption = convertNameCaseByOption;

    });

    var sequelizeTypescript = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SequelizeTypescriptEmitter = void 0;

    const importTemplate = `
import { literal } from 'sequelize';
import {
  Model,
  Table,
  Column,
  HasMany,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  DataType,
  Sequelize,
  HasOne,
  DefaultScope,
  Scopes,
  Index,
  createIndexDecorator,
  ForeignKey,
  BelongsTo,
  PrimaryKey,
  AllowNull,
  Default,
  Comment,
} from 'sequelize-typescript';
`;
    class SequelizeTypescriptEmitter {
        dbTypeToDataType(dbtype) {
            if (["varchar", "text", "char"].includes(dbtype.toLowerCase())) {
                return "DataType.STRING";
            }
            else if (["bool", "boolean"].includes(dbtype.toLowerCase())) {
                return "DataType.BOOLEAN";
            }
            else if (["uuid"].includes(dbtype.toLowerCase())) {
                return "DataType.UUID";
            }
            else if (["int", "int2", "int4", "int8", "bigint"].includes(dbtype.toLowerCase())) {
                return "DataType.INTEGER";
            }
            else {
                return `'${dbtype}'`;
            }
        }
        // 컬럼 필드 코드 생성
        generateColumn(column) {
            var _a;
            const columnFieldName = name.convertNameCaseByOption(this.option.outputFieldNameCase, column.name);
            const primaryKey = column.isPrimaryKey
                ? "primaryKey: true, \n\t\t"
                : "";
            const autoIncrement = column.isAutoIncrement
                ? "autoIncrement: true, \n\t\t"
                : "";
            const defaultValue = column.default
                ? `\n\t\tdefault: literal("${column.default.replace('"', '\\"')}"),`
                : "";
            const dataType = this.dbTypeToDataType(column.dbType);
            return `    @Comment(\`${(_a = column.comment) !== null && _a !== void 0 ? _a : ""}\`)
    @Column({
        ${primaryKey}${autoIncrement}field: '${columnFieldName}',
        type: ${dataType}, 
        allowNull: ${!column.isNotNull},${defaultValue}
    })
    ${columnFieldName}: ${column.tsType};`;
        }
        // 테이블 클래스 코드 생성
        generateTableCode(table) {
            const tableClassName = name.convertNameCaseByOption(this.option.outputClassNameCase, table.tableName);
            return `@Table({
    tableName: '${table.tableName}',
    paranoid: false,
    freezeTableName: true,
    timestamps: false,
    createdAt: false,
    updatedAt: false,
    deletedAt: false,
    // schema: 'cp',
})
export class ${tableClassName} extends Model {
${table.columns.map((column) => this.generateColumn(column)).join("\n\n")}
}`;
        }
        emit(tables, option = {
            sourceSplit: true,
            outputClassNameCase: "PASCAL",
            outputFieldNameCase: "CAMEL",
        }) {
            this.option = option;
            if (option === null || option === void 0 ? void 0 : option.sourceSplit) {
                return tables.map((table) => ({
                    sourceName: table.tableName,
                    source: importTemplate + "\n" + this.generateTableCode(table),
                }));
            }
            else {
                return [
                    {
                        sourceName: "all",
                        source: importTemplate +
                            "\n" +
                            tables
                                .map((table) => this.generateTableCode(table))
                                .join("\n\n"),
                    },
                ];
            }
        }
    }
    exports.SequelizeTypescriptEmitter = SequelizeTypescriptEmitter;

    });

    var BigInteger = createCommonjsModule(function (module) {
    var bigInt = (function (undefined$1) {

        var BASE = 1e7,
            LOG_BASE = 7,
            MAX_INT = 9007199254740992,
            MAX_INT_ARR = smallToArray(MAX_INT),
            DEFAULT_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

        var supportsNativeBigInt = typeof BigInt === "function";

        function Integer(v, radix, alphabet, caseSensitive) {
            if (typeof v === "undefined") return Integer[0];
            if (typeof radix !== "undefined") return +radix === 10 && !alphabet ? parseValue(v) : parseBase(v, radix, alphabet, caseSensitive);
            return parseValue(v);
        }

        function BigInteger(value, sign) {
            this.value = value;
            this.sign = sign;
            this.isSmall = false;
        }
        BigInteger.prototype = Object.create(Integer.prototype);

        function SmallInteger(value) {
            this.value = value;
            this.sign = value < 0;
            this.isSmall = true;
        }
        SmallInteger.prototype = Object.create(Integer.prototype);

        function NativeBigInt(value) {
            this.value = value;
        }
        NativeBigInt.prototype = Object.create(Integer.prototype);

        function isPrecise(n) {
            return -MAX_INT < n && n < MAX_INT;
        }

        function smallToArray(n) { // For performance reasons doesn't reference BASE, need to change this function if BASE changes
            if (n < 1e7)
                return [n];
            if (n < 1e14)
                return [n % 1e7, Math.floor(n / 1e7)];
            return [n % 1e7, Math.floor(n / 1e7) % 1e7, Math.floor(n / 1e14)];
        }

        function arrayToSmall(arr) { // If BASE changes this function may need to change
            trim(arr);
            var length = arr.length;
            if (length < 4 && compareAbs(arr, MAX_INT_ARR) < 0) {
                switch (length) {
                    case 0: return 0;
                    case 1: return arr[0];
                    case 2: return arr[0] + arr[1] * BASE;
                    default: return arr[0] + (arr[1] + arr[2] * BASE) * BASE;
                }
            }
            return arr;
        }

        function trim(v) {
            var i = v.length;
            while (v[--i] === 0);
            v.length = i + 1;
        }

        function createArray(length) { // function shamelessly stolen from Yaffle's library https://github.com/Yaffle/BigInteger
            var x = new Array(length);
            var i = -1;
            while (++i < length) {
                x[i] = 0;
            }
            return x;
        }

        function truncate(n) {
            if (n > 0) return Math.floor(n);
            return Math.ceil(n);
        }

        function add(a, b) { // assumes a and b are arrays with a.length >= b.length
            var l_a = a.length,
                l_b = b.length,
                r = new Array(l_a),
                carry = 0,
                base = BASE,
                sum, i;
            for (i = 0; i < l_b; i++) {
                sum = a[i] + b[i] + carry;
                carry = sum >= base ? 1 : 0;
                r[i] = sum - carry * base;
            }
            while (i < l_a) {
                sum = a[i] + carry;
                carry = sum === base ? 1 : 0;
                r[i++] = sum - carry * base;
            }
            if (carry > 0) r.push(carry);
            return r;
        }

        function addAny(a, b) {
            if (a.length >= b.length) return add(a, b);
            return add(b, a);
        }

        function addSmall(a, carry) { // assumes a is array, carry is number with 0 <= carry < MAX_INT
            var l = a.length,
                r = new Array(l),
                base = BASE,
                sum, i;
            for (i = 0; i < l; i++) {
                sum = a[i] - base + carry;
                carry = Math.floor(sum / base);
                r[i] = sum - carry * base;
                carry += 1;
            }
            while (carry > 0) {
                r[i++] = carry % base;
                carry = Math.floor(carry / base);
            }
            return r;
        }

        BigInteger.prototype.add = function (v) {
            var n = parseValue(v);
            if (this.sign !== n.sign) {
                return this.subtract(n.negate());
            }
            var a = this.value, b = n.value;
            if (n.isSmall) {
                return new BigInteger(addSmall(a, Math.abs(b)), this.sign);
            }
            return new BigInteger(addAny(a, b), this.sign);
        };
        BigInteger.prototype.plus = BigInteger.prototype.add;

        SmallInteger.prototype.add = function (v) {
            var n = parseValue(v);
            var a = this.value;
            if (a < 0 !== n.sign) {
                return this.subtract(n.negate());
            }
            var b = n.value;
            if (n.isSmall) {
                if (isPrecise(a + b)) return new SmallInteger(a + b);
                b = smallToArray(Math.abs(b));
            }
            return new BigInteger(addSmall(b, Math.abs(a)), a < 0);
        };
        SmallInteger.prototype.plus = SmallInteger.prototype.add;

        NativeBigInt.prototype.add = function (v) {
            return new NativeBigInt(this.value + parseValue(v).value);
        };
        NativeBigInt.prototype.plus = NativeBigInt.prototype.add;

        function subtract(a, b) { // assumes a and b are arrays with a >= b
            var a_l = a.length,
                b_l = b.length,
                r = new Array(a_l),
                borrow = 0,
                base = BASE,
                i, difference;
            for (i = 0; i < b_l; i++) {
                difference = a[i] - borrow - b[i];
                if (difference < 0) {
                    difference += base;
                    borrow = 1;
                } else borrow = 0;
                r[i] = difference;
            }
            for (i = b_l; i < a_l; i++) {
                difference = a[i] - borrow;
                if (difference < 0) difference += base;
                else {
                    r[i++] = difference;
                    break;
                }
                r[i] = difference;
            }
            for (; i < a_l; i++) {
                r[i] = a[i];
            }
            trim(r);
            return r;
        }

        function subtractAny(a, b, sign) {
            var value;
            if (compareAbs(a, b) >= 0) {
                value = subtract(a, b);
            } else {
                value = subtract(b, a);
                sign = !sign;
            }
            value = arrayToSmall(value);
            if (typeof value === "number") {
                if (sign) value = -value;
                return new SmallInteger(value);
            }
            return new BigInteger(value, sign);
        }

        function subtractSmall(a, b, sign) { // assumes a is array, b is number with 0 <= b < MAX_INT
            var l = a.length,
                r = new Array(l),
                carry = -b,
                base = BASE,
                i, difference;
            for (i = 0; i < l; i++) {
                difference = a[i] + carry;
                carry = Math.floor(difference / base);
                difference %= base;
                r[i] = difference < 0 ? difference + base : difference;
            }
            r = arrayToSmall(r);
            if (typeof r === "number") {
                if (sign) r = -r;
                return new SmallInteger(r);
            } return new BigInteger(r, sign);
        }

        BigInteger.prototype.subtract = function (v) {
            var n = parseValue(v);
            if (this.sign !== n.sign) {
                return this.add(n.negate());
            }
            var a = this.value, b = n.value;
            if (n.isSmall)
                return subtractSmall(a, Math.abs(b), this.sign);
            return subtractAny(a, b, this.sign);
        };
        BigInteger.prototype.minus = BigInteger.prototype.subtract;

        SmallInteger.prototype.subtract = function (v) {
            var n = parseValue(v);
            var a = this.value;
            if (a < 0 !== n.sign) {
                return this.add(n.negate());
            }
            var b = n.value;
            if (n.isSmall) {
                return new SmallInteger(a - b);
            }
            return subtractSmall(b, Math.abs(a), a >= 0);
        };
        SmallInteger.prototype.minus = SmallInteger.prototype.subtract;

        NativeBigInt.prototype.subtract = function (v) {
            return new NativeBigInt(this.value - parseValue(v).value);
        };
        NativeBigInt.prototype.minus = NativeBigInt.prototype.subtract;

        BigInteger.prototype.negate = function () {
            return new BigInteger(this.value, !this.sign);
        };
        SmallInteger.prototype.negate = function () {
            var sign = this.sign;
            var small = new SmallInteger(-this.value);
            small.sign = !sign;
            return small;
        };
        NativeBigInt.prototype.negate = function () {
            return new NativeBigInt(-this.value);
        };

        BigInteger.prototype.abs = function () {
            return new BigInteger(this.value, false);
        };
        SmallInteger.prototype.abs = function () {
            return new SmallInteger(Math.abs(this.value));
        };
        NativeBigInt.prototype.abs = function () {
            return new NativeBigInt(this.value >= 0 ? this.value : -this.value);
        };


        function multiplyLong(a, b) {
            var a_l = a.length,
                b_l = b.length,
                l = a_l + b_l,
                r = createArray(l),
                base = BASE,
                product, carry, i, a_i, b_j;
            for (i = 0; i < a_l; ++i) {
                a_i = a[i];
                for (var j = 0; j < b_l; ++j) {
                    b_j = b[j];
                    product = a_i * b_j + r[i + j];
                    carry = Math.floor(product / base);
                    r[i + j] = product - carry * base;
                    r[i + j + 1] += carry;
                }
            }
            trim(r);
            return r;
        }

        function multiplySmall(a, b) { // assumes a is array, b is number with |b| < BASE
            var l = a.length,
                r = new Array(l),
                base = BASE,
                carry = 0,
                product, i;
            for (i = 0; i < l; i++) {
                product = a[i] * b + carry;
                carry = Math.floor(product / base);
                r[i] = product - carry * base;
            }
            while (carry > 0) {
                r[i++] = carry % base;
                carry = Math.floor(carry / base);
            }
            return r;
        }

        function shiftLeft(x, n) {
            var r = [];
            while (n-- > 0) r.push(0);
            return r.concat(x);
        }

        function multiplyKaratsuba(x, y) {
            var n = Math.max(x.length, y.length);

            if (n <= 30) return multiplyLong(x, y);
            n = Math.ceil(n / 2);

            var b = x.slice(n),
                a = x.slice(0, n),
                d = y.slice(n),
                c = y.slice(0, n);

            var ac = multiplyKaratsuba(a, c),
                bd = multiplyKaratsuba(b, d),
                abcd = multiplyKaratsuba(addAny(a, b), addAny(c, d));

            var product = addAny(addAny(ac, shiftLeft(subtract(subtract(abcd, ac), bd), n)), shiftLeft(bd, 2 * n));
            trim(product);
            return product;
        }

        // The following function is derived from a surface fit of a graph plotting the performance difference
        // between long multiplication and karatsuba multiplication versus the lengths of the two arrays.
        function useKaratsuba(l1, l2) {
            return -0.012 * l1 - 0.012 * l2 + 0.000015 * l1 * l2 > 0;
        }

        BigInteger.prototype.multiply = function (v) {
            var n = parseValue(v),
                a = this.value, b = n.value,
                sign = this.sign !== n.sign,
                abs;
            if (n.isSmall) {
                if (b === 0) return Integer[0];
                if (b === 1) return this;
                if (b === -1) return this.negate();
                abs = Math.abs(b);
                if (abs < BASE) {
                    return new BigInteger(multiplySmall(a, abs), sign);
                }
                b = smallToArray(abs);
            }
            if (useKaratsuba(a.length, b.length)) // Karatsuba is only faster for certain array sizes
                return new BigInteger(multiplyKaratsuba(a, b), sign);
            return new BigInteger(multiplyLong(a, b), sign);
        };

        BigInteger.prototype.times = BigInteger.prototype.multiply;

        function multiplySmallAndArray(a, b, sign) { // a >= 0
            if (a < BASE) {
                return new BigInteger(multiplySmall(b, a), sign);
            }
            return new BigInteger(multiplyLong(b, smallToArray(a)), sign);
        }
        SmallInteger.prototype._multiplyBySmall = function (a) {
            if (isPrecise(a.value * this.value)) {
                return new SmallInteger(a.value * this.value);
            }
            return multiplySmallAndArray(Math.abs(a.value), smallToArray(Math.abs(this.value)), this.sign !== a.sign);
        };
        BigInteger.prototype._multiplyBySmall = function (a) {
            if (a.value === 0) return Integer[0];
            if (a.value === 1) return this;
            if (a.value === -1) return this.negate();
            return multiplySmallAndArray(Math.abs(a.value), this.value, this.sign !== a.sign);
        };
        SmallInteger.prototype.multiply = function (v) {
            return parseValue(v)._multiplyBySmall(this);
        };
        SmallInteger.prototype.times = SmallInteger.prototype.multiply;

        NativeBigInt.prototype.multiply = function (v) {
            return new NativeBigInt(this.value * parseValue(v).value);
        };
        NativeBigInt.prototype.times = NativeBigInt.prototype.multiply;

        function square(a) {
            //console.assert(2 * BASE * BASE < MAX_INT);
            var l = a.length,
                r = createArray(l + l),
                base = BASE,
                product, carry, i, a_i, a_j;
            for (i = 0; i < l; i++) {
                a_i = a[i];
                carry = 0 - a_i * a_i;
                for (var j = i; j < l; j++) {
                    a_j = a[j];
                    product = 2 * (a_i * a_j) + r[i + j] + carry;
                    carry = Math.floor(product / base);
                    r[i + j] = product - carry * base;
                }
                r[i + l] = carry;
            }
            trim(r);
            return r;
        }

        BigInteger.prototype.square = function () {
            return new BigInteger(square(this.value), false);
        };

        SmallInteger.prototype.square = function () {
            var value = this.value * this.value;
            if (isPrecise(value)) return new SmallInteger(value);
            return new BigInteger(square(smallToArray(Math.abs(this.value))), false);
        };

        NativeBigInt.prototype.square = function (v) {
            return new NativeBigInt(this.value * this.value);
        };

        function divMod1(a, b) { // Left over from previous version. Performs faster than divMod2 on smaller input sizes.
            var a_l = a.length,
                b_l = b.length,
                base = BASE,
                result = createArray(b.length),
                divisorMostSignificantDigit = b[b_l - 1],
                // normalization
                lambda = Math.ceil(base / (2 * divisorMostSignificantDigit)),
                remainder = multiplySmall(a, lambda),
                divisor = multiplySmall(b, lambda),
                quotientDigit, shift, carry, borrow, i, l, q;
            if (remainder.length <= a_l) remainder.push(0);
            divisor.push(0);
            divisorMostSignificantDigit = divisor[b_l - 1];
            for (shift = a_l - b_l; shift >= 0; shift--) {
                quotientDigit = base - 1;
                if (remainder[shift + b_l] !== divisorMostSignificantDigit) {
                    quotientDigit = Math.floor((remainder[shift + b_l] * base + remainder[shift + b_l - 1]) / divisorMostSignificantDigit);
                }
                // quotientDigit <= base - 1
                carry = 0;
                borrow = 0;
                l = divisor.length;
                for (i = 0; i < l; i++) {
                    carry += quotientDigit * divisor[i];
                    q = Math.floor(carry / base);
                    borrow += remainder[shift + i] - (carry - q * base);
                    carry = q;
                    if (borrow < 0) {
                        remainder[shift + i] = borrow + base;
                        borrow = -1;
                    } else {
                        remainder[shift + i] = borrow;
                        borrow = 0;
                    }
                }
                while (borrow !== 0) {
                    quotientDigit -= 1;
                    carry = 0;
                    for (i = 0; i < l; i++) {
                        carry += remainder[shift + i] - base + divisor[i];
                        if (carry < 0) {
                            remainder[shift + i] = carry + base;
                            carry = 0;
                        } else {
                            remainder[shift + i] = carry;
                            carry = 1;
                        }
                    }
                    borrow += carry;
                }
                result[shift] = quotientDigit;
            }
            // denormalization
            remainder = divModSmall(remainder, lambda)[0];
            return [arrayToSmall(result), arrayToSmall(remainder)];
        }

        function divMod2(a, b) { // Implementation idea shamelessly stolen from Silent Matt's library http://silentmatt.com/biginteger/
            // Performs faster than divMod1 on larger input sizes.
            var a_l = a.length,
                b_l = b.length,
                result = [],
                part = [],
                base = BASE,
                guess, xlen, highx, highy, check;
            while (a_l) {
                part.unshift(a[--a_l]);
                trim(part);
                if (compareAbs(part, b) < 0) {
                    result.push(0);
                    continue;
                }
                xlen = part.length;
                highx = part[xlen - 1] * base + part[xlen - 2];
                highy = b[b_l - 1] * base + b[b_l - 2];
                if (xlen > b_l) {
                    highx = (highx + 1) * base;
                }
                guess = Math.ceil(highx / highy);
                do {
                    check = multiplySmall(b, guess);
                    if (compareAbs(check, part) <= 0) break;
                    guess--;
                } while (guess);
                result.push(guess);
                part = subtract(part, check);
            }
            result.reverse();
            return [arrayToSmall(result), arrayToSmall(part)];
        }

        function divModSmall(value, lambda) {
            var length = value.length,
                quotient = createArray(length),
                base = BASE,
                i, q, remainder, divisor;
            remainder = 0;
            for (i = length - 1; i >= 0; --i) {
                divisor = remainder * base + value[i];
                q = truncate(divisor / lambda);
                remainder = divisor - q * lambda;
                quotient[i] = q | 0;
            }
            return [quotient, remainder | 0];
        }

        function divModAny(self, v) {
            var value, n = parseValue(v);
            if (supportsNativeBigInt) {
                return [new NativeBigInt(self.value / n.value), new NativeBigInt(self.value % n.value)];
            }
            var a = self.value, b = n.value;
            var quotient;
            if (b === 0) throw new Error("Cannot divide by zero");
            if (self.isSmall) {
                if (n.isSmall) {
                    return [new SmallInteger(truncate(a / b)), new SmallInteger(a % b)];
                }
                return [Integer[0], self];
            }
            if (n.isSmall) {
                if (b === 1) return [self, Integer[0]];
                if (b == -1) return [self.negate(), Integer[0]];
                var abs = Math.abs(b);
                if (abs < BASE) {
                    value = divModSmall(a, abs);
                    quotient = arrayToSmall(value[0]);
                    var remainder = value[1];
                    if (self.sign) remainder = -remainder;
                    if (typeof quotient === "number") {
                        if (self.sign !== n.sign) quotient = -quotient;
                        return [new SmallInteger(quotient), new SmallInteger(remainder)];
                    }
                    return [new BigInteger(quotient, self.sign !== n.sign), new SmallInteger(remainder)];
                }
                b = smallToArray(abs);
            }
            var comparison = compareAbs(a, b);
            if (comparison === -1) return [Integer[0], self];
            if (comparison === 0) return [Integer[self.sign === n.sign ? 1 : -1], Integer[0]];

            // divMod1 is faster on smaller input sizes
            if (a.length + b.length <= 200)
                value = divMod1(a, b);
            else value = divMod2(a, b);

            quotient = value[0];
            var qSign = self.sign !== n.sign,
                mod = value[1],
                mSign = self.sign;
            if (typeof quotient === "number") {
                if (qSign) quotient = -quotient;
                quotient = new SmallInteger(quotient);
            } else quotient = new BigInteger(quotient, qSign);
            if (typeof mod === "number") {
                if (mSign) mod = -mod;
                mod = new SmallInteger(mod);
            } else mod = new BigInteger(mod, mSign);
            return [quotient, mod];
        }

        BigInteger.prototype.divmod = function (v) {
            var result = divModAny(this, v);
            return {
                quotient: result[0],
                remainder: result[1]
            };
        };
        NativeBigInt.prototype.divmod = SmallInteger.prototype.divmod = BigInteger.prototype.divmod;


        BigInteger.prototype.divide = function (v) {
            return divModAny(this, v)[0];
        };
        NativeBigInt.prototype.over = NativeBigInt.prototype.divide = function (v) {
            return new NativeBigInt(this.value / parseValue(v).value);
        };
        SmallInteger.prototype.over = SmallInteger.prototype.divide = BigInteger.prototype.over = BigInteger.prototype.divide;

        BigInteger.prototype.mod = function (v) {
            return divModAny(this, v)[1];
        };
        NativeBigInt.prototype.mod = NativeBigInt.prototype.remainder = function (v) {
            return new NativeBigInt(this.value % parseValue(v).value);
        };
        SmallInteger.prototype.remainder = SmallInteger.prototype.mod = BigInteger.prototype.remainder = BigInteger.prototype.mod;

        BigInteger.prototype.pow = function (v) {
            var n = parseValue(v),
                a = this.value,
                b = n.value,
                value, x, y;
            if (b === 0) return Integer[1];
            if (a === 0) return Integer[0];
            if (a === 1) return Integer[1];
            if (a === -1) return n.isEven() ? Integer[1] : Integer[-1];
            if (n.sign) {
                return Integer[0];
            }
            if (!n.isSmall) throw new Error("The exponent " + n.toString() + " is too large.");
            if (this.isSmall) {
                if (isPrecise(value = Math.pow(a, b)))
                    return new SmallInteger(truncate(value));
            }
            x = this;
            y = Integer[1];
            while (true) {
                if (b & 1 === 1) {
                    y = y.times(x);
                    --b;
                }
                if (b === 0) break;
                b /= 2;
                x = x.square();
            }
            return y;
        };
        SmallInteger.prototype.pow = BigInteger.prototype.pow;

        NativeBigInt.prototype.pow = function (v) {
            var n = parseValue(v);
            var a = this.value, b = n.value;
            var _0 = BigInt(0), _1 = BigInt(1), _2 = BigInt(2);
            if (b === _0) return Integer[1];
            if (a === _0) return Integer[0];
            if (a === _1) return Integer[1];
            if (a === BigInt(-1)) return n.isEven() ? Integer[1] : Integer[-1];
            if (n.isNegative()) return new NativeBigInt(_0);
            var x = this;
            var y = Integer[1];
            while (true) {
                if ((b & _1) === _1) {
                    y = y.times(x);
                    --b;
                }
                if (b === _0) break;
                b /= _2;
                x = x.square();
            }
            return y;
        };

        BigInteger.prototype.modPow = function (exp, mod) {
            exp = parseValue(exp);
            mod = parseValue(mod);
            if (mod.isZero()) throw new Error("Cannot take modPow with modulus 0");
            var r = Integer[1],
                base = this.mod(mod);
            if (exp.isNegative()) {
                exp = exp.multiply(Integer[-1]);
                base = base.modInv(mod);
            }
            while (exp.isPositive()) {
                if (base.isZero()) return Integer[0];
                if (exp.isOdd()) r = r.multiply(base).mod(mod);
                exp = exp.divide(2);
                base = base.square().mod(mod);
            }
            return r;
        };
        NativeBigInt.prototype.modPow = SmallInteger.prototype.modPow = BigInteger.prototype.modPow;

        function compareAbs(a, b) {
            if (a.length !== b.length) {
                return a.length > b.length ? 1 : -1;
            }
            for (var i = a.length - 1; i >= 0; i--) {
                if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
            }
            return 0;
        }

        BigInteger.prototype.compareAbs = function (v) {
            var n = parseValue(v),
                a = this.value,
                b = n.value;
            if (n.isSmall) return 1;
            return compareAbs(a, b);
        };
        SmallInteger.prototype.compareAbs = function (v) {
            var n = parseValue(v),
                a = Math.abs(this.value),
                b = n.value;
            if (n.isSmall) {
                b = Math.abs(b);
                return a === b ? 0 : a > b ? 1 : -1;
            }
            return -1;
        };
        NativeBigInt.prototype.compareAbs = function (v) {
            var a = this.value;
            var b = parseValue(v).value;
            a = a >= 0 ? a : -a;
            b = b >= 0 ? b : -b;
            return a === b ? 0 : a > b ? 1 : -1;
        };

        BigInteger.prototype.compare = function (v) {
            // See discussion about comparison with Infinity:
            // https://github.com/peterolson/BigInteger.js/issues/61
            if (v === Infinity) {
                return -1;
            }
            if (v === -Infinity) {
                return 1;
            }

            var n = parseValue(v),
                a = this.value,
                b = n.value;
            if (this.sign !== n.sign) {
                return n.sign ? 1 : -1;
            }
            if (n.isSmall) {
                return this.sign ? -1 : 1;
            }
            return compareAbs(a, b) * (this.sign ? -1 : 1);
        };
        BigInteger.prototype.compareTo = BigInteger.prototype.compare;

        SmallInteger.prototype.compare = function (v) {
            if (v === Infinity) {
                return -1;
            }
            if (v === -Infinity) {
                return 1;
            }

            var n = parseValue(v),
                a = this.value,
                b = n.value;
            if (n.isSmall) {
                return a == b ? 0 : a > b ? 1 : -1;
            }
            if (a < 0 !== n.sign) {
                return a < 0 ? -1 : 1;
            }
            return a < 0 ? 1 : -1;
        };
        SmallInteger.prototype.compareTo = SmallInteger.prototype.compare;

        NativeBigInt.prototype.compare = function (v) {
            if (v === Infinity) {
                return -1;
            }
            if (v === -Infinity) {
                return 1;
            }
            var a = this.value;
            var b = parseValue(v).value;
            return a === b ? 0 : a > b ? 1 : -1;
        };
        NativeBigInt.prototype.compareTo = NativeBigInt.prototype.compare;

        BigInteger.prototype.equals = function (v) {
            return this.compare(v) === 0;
        };
        NativeBigInt.prototype.eq = NativeBigInt.prototype.equals = SmallInteger.prototype.eq = SmallInteger.prototype.equals = BigInteger.prototype.eq = BigInteger.prototype.equals;

        BigInteger.prototype.notEquals = function (v) {
            return this.compare(v) !== 0;
        };
        NativeBigInt.prototype.neq = NativeBigInt.prototype.notEquals = SmallInteger.prototype.neq = SmallInteger.prototype.notEquals = BigInteger.prototype.neq = BigInteger.prototype.notEquals;

        BigInteger.prototype.greater = function (v) {
            return this.compare(v) > 0;
        };
        NativeBigInt.prototype.gt = NativeBigInt.prototype.greater = SmallInteger.prototype.gt = SmallInteger.prototype.greater = BigInteger.prototype.gt = BigInteger.prototype.greater;

        BigInteger.prototype.lesser = function (v) {
            return this.compare(v) < 0;
        };
        NativeBigInt.prototype.lt = NativeBigInt.prototype.lesser = SmallInteger.prototype.lt = SmallInteger.prototype.lesser = BigInteger.prototype.lt = BigInteger.prototype.lesser;

        BigInteger.prototype.greaterOrEquals = function (v) {
            return this.compare(v) >= 0;
        };
        NativeBigInt.prototype.geq = NativeBigInt.prototype.greaterOrEquals = SmallInteger.prototype.geq = SmallInteger.prototype.greaterOrEquals = BigInteger.prototype.geq = BigInteger.prototype.greaterOrEquals;

        BigInteger.prototype.lesserOrEquals = function (v) {
            return this.compare(v) <= 0;
        };
        NativeBigInt.prototype.leq = NativeBigInt.prototype.lesserOrEquals = SmallInteger.prototype.leq = SmallInteger.prototype.lesserOrEquals = BigInteger.prototype.leq = BigInteger.prototype.lesserOrEquals;

        BigInteger.prototype.isEven = function () {
            return (this.value[0] & 1) === 0;
        };
        SmallInteger.prototype.isEven = function () {
            return (this.value & 1) === 0;
        };
        NativeBigInt.prototype.isEven = function () {
            return (this.value & BigInt(1)) === BigInt(0);
        };

        BigInteger.prototype.isOdd = function () {
            return (this.value[0] & 1) === 1;
        };
        SmallInteger.prototype.isOdd = function () {
            return (this.value & 1) === 1;
        };
        NativeBigInt.prototype.isOdd = function () {
            return (this.value & BigInt(1)) === BigInt(1);
        };

        BigInteger.prototype.isPositive = function () {
            return !this.sign;
        };
        SmallInteger.prototype.isPositive = function () {
            return this.value > 0;
        };
        NativeBigInt.prototype.isPositive = SmallInteger.prototype.isPositive;

        BigInteger.prototype.isNegative = function () {
            return this.sign;
        };
        SmallInteger.prototype.isNegative = function () {
            return this.value < 0;
        };
        NativeBigInt.prototype.isNegative = SmallInteger.prototype.isNegative;

        BigInteger.prototype.isUnit = function () {
            return false;
        };
        SmallInteger.prototype.isUnit = function () {
            return Math.abs(this.value) === 1;
        };
        NativeBigInt.prototype.isUnit = function () {
            return this.abs().value === BigInt(1);
        };

        BigInteger.prototype.isZero = function () {
            return false;
        };
        SmallInteger.prototype.isZero = function () {
            return this.value === 0;
        };
        NativeBigInt.prototype.isZero = function () {
            return this.value === BigInt(0);
        };

        BigInteger.prototype.isDivisibleBy = function (v) {
            var n = parseValue(v);
            if (n.isZero()) return false;
            if (n.isUnit()) return true;
            if (n.compareAbs(2) === 0) return this.isEven();
            return this.mod(n).isZero();
        };
        NativeBigInt.prototype.isDivisibleBy = SmallInteger.prototype.isDivisibleBy = BigInteger.prototype.isDivisibleBy;

        function isBasicPrime(v) {
            var n = v.abs();
            if (n.isUnit()) return false;
            if (n.equals(2) || n.equals(3) || n.equals(5)) return true;
            if (n.isEven() || n.isDivisibleBy(3) || n.isDivisibleBy(5)) return false;
            if (n.lesser(49)) return true;
            // we don't know if it's prime: let the other functions figure it out
        }

        function millerRabinTest(n, a) {
            var nPrev = n.prev(),
                b = nPrev,
                r = 0,
                d, i, x;
            while (b.isEven()) b = b.divide(2), r++;
            next: for (i = 0; i < a.length; i++) {
                if (n.lesser(a[i])) continue;
                x = bigInt(a[i]).modPow(b, n);
                if (x.isUnit() || x.equals(nPrev)) continue;
                for (d = r - 1; d != 0; d--) {
                    x = x.square().mod(n);
                    if (x.isUnit()) return false;
                    if (x.equals(nPrev)) continue next;
                }
                return false;
            }
            return true;
        }

        // Set "strict" to true to force GRH-supported lower bound of 2*log(N)^2
        BigInteger.prototype.isPrime = function (strict) {
            var isPrime = isBasicPrime(this);
            if (isPrime !== undefined$1) return isPrime;
            var n = this.abs();
            var bits = n.bitLength();
            if (bits <= 64)
                return millerRabinTest(n, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
            var logN = Math.log(2) * bits.toJSNumber();
            var t = Math.ceil((strict === true) ? (2 * Math.pow(logN, 2)) : logN);
            for (var a = [], i = 0; i < t; i++) {
                a.push(bigInt(i + 2));
            }
            return millerRabinTest(n, a);
        };
        NativeBigInt.prototype.isPrime = SmallInteger.prototype.isPrime = BigInteger.prototype.isPrime;

        BigInteger.prototype.isProbablePrime = function (iterations, rng) {
            var isPrime = isBasicPrime(this);
            if (isPrime !== undefined$1) return isPrime;
            var n = this.abs();
            var t = iterations === undefined$1 ? 5 : iterations;
            for (var a = [], i = 0; i < t; i++) {
                a.push(bigInt.randBetween(2, n.minus(2), rng));
            }
            return millerRabinTest(n, a);
        };
        NativeBigInt.prototype.isProbablePrime = SmallInteger.prototype.isProbablePrime = BigInteger.prototype.isProbablePrime;

        BigInteger.prototype.modInv = function (n) {
            var t = bigInt.zero, newT = bigInt.one, r = parseValue(n), newR = this.abs(), q, lastT, lastR;
            while (!newR.isZero()) {
                q = r.divide(newR);
                lastT = t;
                lastR = r;
                t = newT;
                r = newR;
                newT = lastT.subtract(q.multiply(newT));
                newR = lastR.subtract(q.multiply(newR));
            }
            if (!r.isUnit()) throw new Error(this.toString() + " and " + n.toString() + " are not co-prime");
            if (t.compare(0) === -1) {
                t = t.add(n);
            }
            if (this.isNegative()) {
                return t.negate();
            }
            return t;
        };

        NativeBigInt.prototype.modInv = SmallInteger.prototype.modInv = BigInteger.prototype.modInv;

        BigInteger.prototype.next = function () {
            var value = this.value;
            if (this.sign) {
                return subtractSmall(value, 1, this.sign);
            }
            return new BigInteger(addSmall(value, 1), this.sign);
        };
        SmallInteger.prototype.next = function () {
            var value = this.value;
            if (value + 1 < MAX_INT) return new SmallInteger(value + 1);
            return new BigInteger(MAX_INT_ARR, false);
        };
        NativeBigInt.prototype.next = function () {
            return new NativeBigInt(this.value + BigInt(1));
        };

        BigInteger.prototype.prev = function () {
            var value = this.value;
            if (this.sign) {
                return new BigInteger(addSmall(value, 1), true);
            }
            return subtractSmall(value, 1, this.sign);
        };
        SmallInteger.prototype.prev = function () {
            var value = this.value;
            if (value - 1 > -MAX_INT) return new SmallInteger(value - 1);
            return new BigInteger(MAX_INT_ARR, true);
        };
        NativeBigInt.prototype.prev = function () {
            return new NativeBigInt(this.value - BigInt(1));
        };

        var powersOfTwo = [1];
        while (2 * powersOfTwo[powersOfTwo.length - 1] <= BASE) powersOfTwo.push(2 * powersOfTwo[powersOfTwo.length - 1]);
        var powers2Length = powersOfTwo.length, highestPower2 = powersOfTwo[powers2Length - 1];

        function shift_isSmall(n) {
            return Math.abs(n) <= BASE;
        }

        BigInteger.prototype.shiftLeft = function (v) {
            var n = parseValue(v).toJSNumber();
            if (!shift_isSmall(n)) {
                throw new Error(String(n) + " is too large for shifting.");
            }
            if (n < 0) return this.shiftRight(-n);
            var result = this;
            if (result.isZero()) return result;
            while (n >= powers2Length) {
                result = result.multiply(highestPower2);
                n -= powers2Length - 1;
            }
            return result.multiply(powersOfTwo[n]);
        };
        NativeBigInt.prototype.shiftLeft = SmallInteger.prototype.shiftLeft = BigInteger.prototype.shiftLeft;

        BigInteger.prototype.shiftRight = function (v) {
            var remQuo;
            var n = parseValue(v).toJSNumber();
            if (!shift_isSmall(n)) {
                throw new Error(String(n) + " is too large for shifting.");
            }
            if (n < 0) return this.shiftLeft(-n);
            var result = this;
            while (n >= powers2Length) {
                if (result.isZero() || (result.isNegative() && result.isUnit())) return result;
                remQuo = divModAny(result, highestPower2);
                result = remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
                n -= powers2Length - 1;
            }
            remQuo = divModAny(result, powersOfTwo[n]);
            return remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
        };
        NativeBigInt.prototype.shiftRight = SmallInteger.prototype.shiftRight = BigInteger.prototype.shiftRight;

        function bitwise(x, y, fn) {
            y = parseValue(y);
            var xSign = x.isNegative(), ySign = y.isNegative();
            var xRem = xSign ? x.not() : x,
                yRem = ySign ? y.not() : y;
            var xDigit = 0, yDigit = 0;
            var xDivMod = null, yDivMod = null;
            var result = [];
            while (!xRem.isZero() || !yRem.isZero()) {
                xDivMod = divModAny(xRem, highestPower2);
                xDigit = xDivMod[1].toJSNumber();
                if (xSign) {
                    xDigit = highestPower2 - 1 - xDigit; // two's complement for negative numbers
                }

                yDivMod = divModAny(yRem, highestPower2);
                yDigit = yDivMod[1].toJSNumber();
                if (ySign) {
                    yDigit = highestPower2 - 1 - yDigit; // two's complement for negative numbers
                }

                xRem = xDivMod[0];
                yRem = yDivMod[0];
                result.push(fn(xDigit, yDigit));
            }
            var sum = fn(xSign ? 1 : 0, ySign ? 1 : 0) !== 0 ? bigInt(-1) : bigInt(0);
            for (var i = result.length - 1; i >= 0; i -= 1) {
                sum = sum.multiply(highestPower2).add(bigInt(result[i]));
            }
            return sum;
        }

        BigInteger.prototype.not = function () {
            return this.negate().prev();
        };
        NativeBigInt.prototype.not = SmallInteger.prototype.not = BigInteger.prototype.not;

        BigInteger.prototype.and = function (n) {
            return bitwise(this, n, function (a, b) { return a & b; });
        };
        NativeBigInt.prototype.and = SmallInteger.prototype.and = BigInteger.prototype.and;

        BigInteger.prototype.or = function (n) {
            return bitwise(this, n, function (a, b) { return a | b; });
        };
        NativeBigInt.prototype.or = SmallInteger.prototype.or = BigInteger.prototype.or;

        BigInteger.prototype.xor = function (n) {
            return bitwise(this, n, function (a, b) { return a ^ b; });
        };
        NativeBigInt.prototype.xor = SmallInteger.prototype.xor = BigInteger.prototype.xor;

        var LOBMASK_I = 1 << 30, LOBMASK_BI = (BASE & -BASE) * (BASE & -BASE) | LOBMASK_I;
        function roughLOB(n) { // get lowestOneBit (rough)
            // SmallInteger: return Min(lowestOneBit(n), 1 << 30)
            // BigInteger: return Min(lowestOneBit(n), 1 << 14) [BASE=1e7]
            var v = n.value,
                x = typeof v === "number" ? v | LOBMASK_I :
                    typeof v === "bigint" ? v | BigInt(LOBMASK_I) :
                        v[0] + v[1] * BASE | LOBMASK_BI;
            return x & -x;
        }

        function integerLogarithm(value, base) {
            if (base.compareTo(value) <= 0) {
                var tmp = integerLogarithm(value, base.square(base));
                var p = tmp.p;
                var e = tmp.e;
                var t = p.multiply(base);
                return t.compareTo(value) <= 0 ? { p: t, e: e * 2 + 1 } : { p: p, e: e * 2 };
            }
            return { p: bigInt(1), e: 0 };
        }

        BigInteger.prototype.bitLength = function () {
            var n = this;
            if (n.compareTo(bigInt(0)) < 0) {
                n = n.negate().subtract(bigInt(1));
            }
            if (n.compareTo(bigInt(0)) === 0) {
                return bigInt(0);
            }
            return bigInt(integerLogarithm(n, bigInt(2)).e).add(bigInt(1));
        };
        NativeBigInt.prototype.bitLength = SmallInteger.prototype.bitLength = BigInteger.prototype.bitLength;

        function max(a, b) {
            a = parseValue(a);
            b = parseValue(b);
            return a.greater(b) ? a : b;
        }
        function min(a, b) {
            a = parseValue(a);
            b = parseValue(b);
            return a.lesser(b) ? a : b;
        }
        function gcd(a, b) {
            a = parseValue(a).abs();
            b = parseValue(b).abs();
            if (a.equals(b)) return a;
            if (a.isZero()) return b;
            if (b.isZero()) return a;
            var c = Integer[1], d, t;
            while (a.isEven() && b.isEven()) {
                d = min(roughLOB(a), roughLOB(b));
                a = a.divide(d);
                b = b.divide(d);
                c = c.multiply(d);
            }
            while (a.isEven()) {
                a = a.divide(roughLOB(a));
            }
            do {
                while (b.isEven()) {
                    b = b.divide(roughLOB(b));
                }
                if (a.greater(b)) {
                    t = b; b = a; a = t;
                }
                b = b.subtract(a);
            } while (!b.isZero());
            return c.isUnit() ? a : a.multiply(c);
        }
        function lcm(a, b) {
            a = parseValue(a).abs();
            b = parseValue(b).abs();
            return a.divide(gcd(a, b)).multiply(b);
        }
        function randBetween(a, b, rng) {
            a = parseValue(a);
            b = parseValue(b);
            var usedRNG = rng || Math.random;
            var low = min(a, b), high = max(a, b);
            var range = high.subtract(low).add(1);
            if (range.isSmall) return low.add(Math.floor(usedRNG() * range));
            var digits = toBase(range, BASE).value;
            var result = [], restricted = true;
            for (var i = 0; i < digits.length; i++) {
                var top = restricted ? digits[i] : BASE;
                var digit = truncate(usedRNG() * top);
                result.push(digit);
                if (digit < top) restricted = false;
            }
            return low.add(Integer.fromArray(result, BASE, false));
        }

        var parseBase = function (text, base, alphabet, caseSensitive) {
            alphabet = alphabet || DEFAULT_ALPHABET;
            text = String(text);
            if (!caseSensitive) {
                text = text.toLowerCase();
                alphabet = alphabet.toLowerCase();
            }
            var length = text.length;
            var i;
            var absBase = Math.abs(base);
            var alphabetValues = {};
            for (i = 0; i < alphabet.length; i++) {
                alphabetValues[alphabet[i]] = i;
            }
            for (i = 0; i < length; i++) {
                var c = text[i];
                if (c === "-") continue;
                if (c in alphabetValues) {
                    if (alphabetValues[c] >= absBase) {
                        if (c === "1" && absBase === 1) continue;
                        throw new Error(c + " is not a valid digit in base " + base + ".");
                    }
                }
            }
            base = parseValue(base);
            var digits = [];
            var isNegative = text[0] === "-";
            for (i = isNegative ? 1 : 0; i < text.length; i++) {
                var c = text[i];
                if (c in alphabetValues) digits.push(parseValue(alphabetValues[c]));
                else if (c === "<") {
                    var start = i;
                    do { i++; } while (text[i] !== ">" && i < text.length);
                    digits.push(parseValue(text.slice(start + 1, i)));
                }
                else throw new Error(c + " is not a valid character");
            }
            return parseBaseFromArray(digits, base, isNegative);
        };

        function parseBaseFromArray(digits, base, isNegative) {
            var val = Integer[0], pow = Integer[1], i;
            for (i = digits.length - 1; i >= 0; i--) {
                val = val.add(digits[i].times(pow));
                pow = pow.times(base);
            }
            return isNegative ? val.negate() : val;
        }

        function stringify(digit, alphabet) {
            alphabet = alphabet || DEFAULT_ALPHABET;
            if (digit < alphabet.length) {
                return alphabet[digit];
            }
            return "<" + digit + ">";
        }

        function toBase(n, base) {
            base = bigInt(base);
            if (base.isZero()) {
                if (n.isZero()) return { value: [0], isNegative: false };
                throw new Error("Cannot convert nonzero numbers to base 0.");
            }
            if (base.equals(-1)) {
                if (n.isZero()) return { value: [0], isNegative: false };
                if (n.isNegative())
                    return {
                        value: [].concat.apply([], Array.apply(null, Array(-n.toJSNumber()))
                            .map(Array.prototype.valueOf, [1, 0])
                        ),
                        isNegative: false
                    };

                var arr = Array.apply(null, Array(n.toJSNumber() - 1))
                    .map(Array.prototype.valueOf, [0, 1]);
                arr.unshift([1]);
                return {
                    value: [].concat.apply([], arr),
                    isNegative: false
                };
            }

            var neg = false;
            if (n.isNegative() && base.isPositive()) {
                neg = true;
                n = n.abs();
            }
            if (base.isUnit()) {
                if (n.isZero()) return { value: [0], isNegative: false };

                return {
                    value: Array.apply(null, Array(n.toJSNumber()))
                        .map(Number.prototype.valueOf, 1),
                    isNegative: neg
                };
            }
            var out = [];
            var left = n, divmod;
            while (left.isNegative() || left.compareAbs(base) >= 0) {
                divmod = left.divmod(base);
                left = divmod.quotient;
                var digit = divmod.remainder;
                if (digit.isNegative()) {
                    digit = base.minus(digit).abs();
                    left = left.next();
                }
                out.push(digit.toJSNumber());
            }
            out.push(left.toJSNumber());
            return { value: out.reverse(), isNegative: neg };
        }

        function toBaseString(n, base, alphabet) {
            var arr = toBase(n, base);
            return (arr.isNegative ? "-" : "") + arr.value.map(function (x) {
                return stringify(x, alphabet);
            }).join('');
        }

        BigInteger.prototype.toArray = function (radix) {
            return toBase(this, radix);
        };

        SmallInteger.prototype.toArray = function (radix) {
            return toBase(this, radix);
        };

        NativeBigInt.prototype.toArray = function (radix) {
            return toBase(this, radix);
        };

        BigInteger.prototype.toString = function (radix, alphabet) {
            if (radix === undefined$1) radix = 10;
            if (radix !== 10) return toBaseString(this, radix, alphabet);
            var v = this.value, l = v.length, str = String(v[--l]), zeros = "0000000", digit;
            while (--l >= 0) {
                digit = String(v[l]);
                str += zeros.slice(digit.length) + digit;
            }
            var sign = this.sign ? "-" : "";
            return sign + str;
        };

        SmallInteger.prototype.toString = function (radix, alphabet) {
            if (radix === undefined$1) radix = 10;
            if (radix != 10) return toBaseString(this, radix, alphabet);
            return String(this.value);
        };

        NativeBigInt.prototype.toString = SmallInteger.prototype.toString;

        NativeBigInt.prototype.toJSON = BigInteger.prototype.toJSON = SmallInteger.prototype.toJSON = function () { return this.toString(); };

        BigInteger.prototype.valueOf = function () {
            return parseInt(this.toString(), 10);
        };
        BigInteger.prototype.toJSNumber = BigInteger.prototype.valueOf;

        SmallInteger.prototype.valueOf = function () {
            return this.value;
        };
        SmallInteger.prototype.toJSNumber = SmallInteger.prototype.valueOf;
        NativeBigInt.prototype.valueOf = NativeBigInt.prototype.toJSNumber = function () {
            return parseInt(this.toString(), 10);
        };

        function parseStringValue(v) {
            if (isPrecise(+v)) {
                var x = +v;
                if (x === truncate(x))
                    return supportsNativeBigInt ? new NativeBigInt(BigInt(x)) : new SmallInteger(x);
                throw new Error("Invalid integer: " + v);
            }
            var sign = v[0] === "-";
            if (sign) v = v.slice(1);
            var split = v.split(/e/i);
            if (split.length > 2) throw new Error("Invalid integer: " + split.join("e"));
            if (split.length === 2) {
                var exp = split[1];
                if (exp[0] === "+") exp = exp.slice(1);
                exp = +exp;
                if (exp !== truncate(exp) || !isPrecise(exp)) throw new Error("Invalid integer: " + exp + " is not a valid exponent.");
                var text = split[0];
                var decimalPlace = text.indexOf(".");
                if (decimalPlace >= 0) {
                    exp -= text.length - decimalPlace - 1;
                    text = text.slice(0, decimalPlace) + text.slice(decimalPlace + 1);
                }
                if (exp < 0) throw new Error("Cannot include negative exponent part for integers");
                text += (new Array(exp + 1)).join("0");
                v = text;
            }
            var isValid = /^([0-9][0-9]*)$/.test(v);
            if (!isValid) throw new Error("Invalid integer: " + v);
            if (supportsNativeBigInt) {
                return new NativeBigInt(BigInt(sign ? "-" + v : v));
            }
            var r = [], max = v.length, l = LOG_BASE, min = max - l;
            while (max > 0) {
                r.push(+v.slice(min, max));
                min -= l;
                if (min < 0) min = 0;
                max -= l;
            }
            trim(r);
            return new BigInteger(r, sign);
        }

        function parseNumberValue(v) {
            if (supportsNativeBigInt) {
                return new NativeBigInt(BigInt(v));
            }
            if (isPrecise(v)) {
                if (v !== truncate(v)) throw new Error(v + " is not an integer.");
                return new SmallInteger(v);
            }
            return parseStringValue(v.toString());
        }

        function parseValue(v) {
            if (typeof v === "number") {
                return parseNumberValue(v);
            }
            if (typeof v === "string") {
                return parseStringValue(v);
            }
            if (typeof v === "bigint") {
                return new NativeBigInt(v);
            }
            return v;
        }
        // Pre-define numbers in range [-999,999]
        for (var i = 0; i < 1000; i++) {
            Integer[i] = parseValue(i);
            if (i > 0) Integer[-i] = parseValue(-i);
        }
        // Backwards compatibility
        Integer.one = Integer[1];
        Integer.zero = Integer[0];
        Integer.minusOne = Integer[-1];
        Integer.max = max;
        Integer.min = min;
        Integer.gcd = gcd;
        Integer.lcm = lcm;
        Integer.isInstance = function (x) { return x instanceof BigInteger || x instanceof SmallInteger || x instanceof NativeBigInt; };
        Integer.randBetween = randBetween;

        Integer.fromArray = function (digits, base, isNegative) {
            return parseBaseFromArray(digits.map(parseValue), parseValue(base || 10), isNegative);
        };

        return Integer;
    })();

    // Node.js check
    if (module.hasOwnProperty("exports")) {
        module.exports = bigInt;
    }
    });

    var nodeSqlParser = createCommonjsModule(function (module, exports) {

    });

    var mysql = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MySQLParser = void 0;

    class MySQLParser {
        constructor() {
            this.mysqlAstParser = new nodeSqlParser.Parser();
        }
        parse(sql) {
            const ast = this.mysqlAstParser.astify(sql, {
                database: "mysql",
            });
            const tables = [];
            for (const node of ast) {
                switch (node === null || node === void 0 ? void 0 : node.type) {
                    case "create":
                        switch (node === null || node === void 0 ? void 0 : node.keyword) {
                            case "table":
                                tables.push(this.parseTable(node));
                                break;
                        }
                        break;
                }
            }
            return tables;
        }
        // 테이블 구성 분석
        parseTable(node) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const table = {
                tableName: (_b = (_a = node === null || node === void 0 ? void 0 : node.table) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.table,
                columns: [],
            };
            for (const nodeOfTable of node.create_definitions) {
                switch (nodeOfTable.resource) {
                    case "column":
                        const columnName = (_c = nodeOfTable === null || nodeOfTable === void 0 ? void 0 : nodeOfTable.column) === null || _c === void 0 ? void 0 : _c.column;
                        const dbType = nodeOfTable === null || nodeOfTable === void 0 ? void 0 : nodeOfTable.definition.dataType;
                        const isAutoIncrement = nodeOfTable.auto_increment === "auto_increment";
                        const isNotNull = ((_d = nodeOfTable.nullable) === null || _d === void 0 ? void 0 : _d.type) === "not null";
                        const isPrimaryKey = false; // ???
                        const defaultValue = (_g = (_f = (_e = nodeOfTable.default_val) === null || _e === void 0 ? void 0 : _e.value) === null || _f === void 0 ? void 0 : _f.value) !== null && _g !== void 0 ? _g : null;
                        const comment = (_j = (_h = nodeOfTable.comment) === null || _h === void 0 ? void 0 : _h.value) === null || _j === void 0 ? void 0 : _j.value;
                        const column = {
                            name: columnName,
                            dbType,
                            tsType: this.convertDbTypeToTsType(dbType),
                            isNotNull,
                            isPrimaryKey,
                            default: defaultValue,
                            isAutoIncrement,
                            comment,
                        };
                        table.columns.push(column);
                        break;
                    case "constraint":
                        switch (nodeOfTable.constraint_type) {
                            case "primary key":
                                table.columns.forEach((column) => {
                                    var _a;
                                    if ((_a = nodeOfTable === null || nodeOfTable === void 0 ? void 0 : nodeOfTable.definition) === null || _a === void 0 ? void 0 : _a.includes(column.name)) {
                                        column.isPrimaryKey = true;
                                    }
                                });
                                break;
                        }
                        break;
                }
            }
            return table;
        }
        // 데이터베이스의 컬럼타입을 타입스크립트 타입으로 변환
        convertDbTypeToTsType(typename) {
            if ([
                "tinyint",
                "smallint",
                "mediumint",
                "int",
                "bigint",
                "decimal",
                "float",
                "double",
            ].includes(typename.toLocaleLowerCase())) {
                return "number";
            }
            else if (["bool", "boolean"].includes(typename.toLocaleLowerCase())) {
                return "boolean";
            }
            else if ([
                "char",
                "varchar",
                "tinytext",
                "text",
                "mediumtext",
                "longtext",
            ].includes(typename.toLocaleLowerCase())) {
                return "string";
            }
            else if (["date", "time", "datetime", "timestamp", "year"].includes(typename.toLocaleLowerCase())) {
                return "Date";
            }
            else {
                return "string";
            }
        }
    }
    exports.MySQLParser = MySQLParser;

    });

    var typeorm = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeOrmEmitter = void 0;

    const importTemplate = `
import {Entity, PrimaryGeneratedColumn, Column, Generated} from "typeorm";
`;
    class TypeOrmEmitter {
        // 컬럼 필드 코드 생성
        generateColumn(column) {
            var _a, _b, _c;
            const columnFieldName = name.convertNameCaseByOption(this.option.outputFieldNameCase, column.name);
            let defaultValue = column.default
                ? `\n\t\tdefault: "${(_a = column.default) === null || _a === void 0 ? void 0 : _a.replace('"', '\\"')}",`
                : "";
            let comment = column.default
                ? `\n\t\tcomment: "${(_c = (_b = column.comment) === null || _b === void 0 ? void 0 : _b.replace('"', '\\"')) !== null && _c !== void 0 ? _c : ""}",`
                : "";
            let nullable = column.default
                ? `\n\t\tnullable: ${!column.isNotNull},`
                : "";
            let columnDecorator = "Column";
            if (column.isPrimaryKey && column.isAutoIncrement) {
                columnDecorator = "PrimaryGeneratedColumn";
                defaultValue = "";
                nullable = "";
            }
            else if (column.isPrimaryKey) {
                columnDecorator = "PrimaryColumn";
                nullable = "";
            }
            else if (column.isAutoIncrement) {
                columnDecorator = "Generated";
                defaultValue = "";
            }
            return `    @${columnDecorator}({
        name: '${column.name}'
        type: '${column.dbType.toLowerCase()}',${nullable}${defaultValue}${comment}
    })
    ${columnFieldName}: ${column.tsType};`;
        }
        // 테이블 클래스 코드 생성
        generateTableCode(table) {
            const tableClassName = name.convertNameCaseByOption(this.option.outputClassNameCase, table.tableName);
            return `@Entity({
    name: '${table.tableName}',
    // database: '',
    // schema : true,
    synchronize : false,
})
export class ${tableClassName} {
${table.columns.map((column) => this.generateColumn(column)).join("\n\n")}
}`;
        }
        emit(tables, option = {
            sourceSplit: true,
            outputClassNameCase: "PASCAL",
            outputFieldNameCase: "CAMEL",
        }) {
            this.option = option;
            if (option === null || option === void 0 ? void 0 : option.sourceSplit) {
                return tables.map((table) => ({
                    sourceName: table.tableName,
                    source: importTemplate + "\n" + this.generateTableCode(table),
                }));
            }
            else {
                return [
                    {
                        sourceName: "all",
                        source: importTemplate +
                            "\n" +
                            tables
                                .map((table) => this.generateTableCode(table))
                                .join("\n\n"),
                    },
                ];
            }
        }
    }
    exports.TypeOrmEmitter = TypeOrmEmitter;

    });

    var lib = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PostgreSQLParser = exports.MySQLParser = exports.SequelizeTypescriptEmitter = exports.TypeOrmEmitter = void 0;

    Object.defineProperty(exports, "PostgreSQLParser", { enumerable: true, get: function () { return postgres.PostgreSQLParser; } });

    Object.defineProperty(exports, "SequelizeTypescriptEmitter", { enumerable: true, get: function () { return sequelizeTypescript.SequelizeTypescriptEmitter; } });

    Object.defineProperty(exports, "MySQLParser", { enumerable: true, get: function () { return mysql.MySQLParser; } });

    Object.defineProperty(exports, "TypeOrmEmitter", { enumerable: true, get: function () { return typeorm.TypeOrmEmitter; } });

    });

    function convert(query, database, orm, fieldname) {
        let parser = null;
        let emitter = null;
        switch (database) {
            case "postgresql":
            case "postgres":
            case "postgre":
            case "pg":
                parser = new lib.PostgreSQLParser();
                break;
            case "mysql":
            case "my":
                parser = new lib.MySQLParser();
                break;
            default:
                console.error("!! 지원되지 않는 데이터베이스입니다.");
                return;
        }
        switch (orm) {
            case "sequelize-typescript":
            case "st":
                emitter = new lib.SequelizeTypescriptEmitter();
                break;
            case "sequelize":
            case "sq":
                console.error("!! 아직 지원되지 않는 ORM입니다.");
                break;
            case "typeorm":
            case "ty":
                emitter = new lib.TypeOrmEmitter();
                break;
            default:
                console.error("!! 지원되지 않는 ORM입니다.");
                return;
        }
        const emitOption = { sourceSplit: true, outputFieldNameCase: fieldname };
        const tables = parser.parse(query + ";");
        const sources = emitter.emit(tables, emitOption);
        return sources[0].source;
    }

    const database = [
        { view: "DB 선택", value: null },
        { view: "MySQL", value: "mysql" },
        { view: "PostgreSQL", value: "pg" },
    ];

    const orm = [
        { view: "ORM 선택", value: null },
        { view: "Sequelize-Typescript", value: "st" },
        { view: "TypeORM", value: "ty" },
    ];

    const fieldname = [
        { view: "Camel Case", value: "CAMEL" },
        { view: "Snake Case-Typescript", value: "SNAKE" },
    ];

    const app = new App({
        target: document.body,
        props: {
            name: "world",
            database,
            orm,
            fieldname,
            convert,
        },
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map