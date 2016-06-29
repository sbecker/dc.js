/**
 * Stack Mixin is an mixin that provides cross-chart support of stackability using d3.layout.stack.
 * @name stackMixin
 * @memberof dc
 * @mixin
 * @param {Object} _chart
 * @return {dc.horizontalStackMixin}
 */
dc.horizontalStackMixin = function (_chart) {

    function prepareValues (layer, layerIdx) {
        var valAccessor = layer.accessor || _chart.valueAccessor();
        layer.name = String(layer.name || layerIdx);
        layer.values = layer.group.all().map(function (d, i) {
            return {
                // X & Y will be flipped post stacking
                x: _chart.keyAccessor()(d, i),
                y: layer.hidden ? null : valAccessor(d, i),
                data: d,
                layer: layer.name,
                hidden: layer.hidden
            };
        });

        layer.values = layer.values.filter(domainFilter());
        return layer.values;
    }

    var _stackLayout = d3.layout.stack()
        .values(prepareValues);

    var _stack = [];
    var _titles = {};

    var _hidableStacks = false;

    function domainFilter () {
        if (!_chart.y()) {
            return d3.functor(true);
        }
        var yDomain = _chart.y().domain();
        if (_chart.isOrdinal()) {
            // TODO #416
            //var domainSet = d3.set(yDomain);
            return function () {
                return true; //domainSet.has(p.y);
            };
        }
        if (_chart.elasticX()) {
            return function () { return true; };
        }
        return function (p) {
            //return true;
            return p.x >= yDomain[0] && p.x <= yDomain[yDomain.length - 1];
        };
    }

    /**
     * Stack a new crossfilter group onto this chart with an optional custom value accessor. All stacks
     * in the same chart will share the same key accessor and therefore the same set of keys.
     *
     * For example, in a stacked bar chart, the bars of each stack will be positioned using the same set
     * of keys on the x axis, while stacked vertically. If name is specified then it will be used to
     * generate the legend label.
     * @method stack
     * @memberof dc.horizontalStackMixin
     * @instance
     * @see {@link https://github.com/square/crossfilter/wiki/API-Reference#group-map-reduce crossfilter.group}
     * @example
     * // stack group using default accessor
     * chart.stack(valueSumGroup)
     * // stack group using custom accessor
     * .stack(avgByDayGroup, function(d){return d.value.avgByDay;});
     * @param {crossfilter.group} group
     * @param {String} [name]
     * @param {Function} [accessor]
     * @return {Array<{group: crossfilter.group, name: String, accessor: Function}>}
     * @return {dc.horizontalStackMixin}
     */
    _chart.stack = function (group, name, accessor) {
        if (!arguments.length) {
            return _stack;
        }

        if (arguments.length <= 2) {
            accessor = name;
        }

        var layer = {group: group};
        if (typeof name === 'string') {
            layer.name = name;
        }
        if (typeof accessor === 'function') {
            layer.accessor = accessor;
        }
        _stack.push(layer);

        return _chart;
    };

    dc.override(_chart, 'group', function (g, n, f) {
        if (!arguments.length) {
            return _chart._group();
        }
        _stack = [];
        _titles = {};
        _chart.stack(g, n);
        if (f) {
            _chart.valueAccessor(f);
        }
        return _chart._group(g, n);
    });

    /**
     * Allow named stacks to be hidden or shown by clicking on legend items.
     * This does not affect the behavior of hideStack or showStack.
     * @method hidableStacks
     * @memberof dc.horizontalStackMixin
     * @instance
     * @param {Boolean} [hidableStacks=false]
     * @return {Boolean}
     * @return {dc.horizontalStackMixin}
     */
    _chart.hidableStacks = function (hidableStacks) {
        if (!arguments.length) {
            return _hidableStacks;
        }
        _hidableStacks = hidableStacks;
        return _chart;
    };

    function findLayerByName (n) {
        var i = _stack.map(dc.pluck('name')).indexOf(n);
        return _stack[i];
    }

    /**
     * Hide all stacks on the chart with the given name.
     * The chart must be re-rendered for this change to appear.
     * @method hideStack
     * @memberof dc.horizontalStackMixin
     * @instance
     * @param {String} stackName
     * @return {dc.horizontalStackMixin}
     */
    _chart.hideStack = function (stackName) {
        var layer = findLayerByName(stackName);
        if (layer) {
            layer.hidden = true;
        }
        return _chart;
    };

    /**
     * Show all stacks on the chart with the given name.
     * The chart must be re-rendered for this change to appear.
     * @method showStack
     * @memberof dc.horizontalStackMixin
     * @instance
     * @param {String} stackName
     * @return {dc.horizontalStackMixin}
     */
    _chart.showStack = function (stackName) {
        var layer = findLayerByName(stackName);
        if (layer) {
            layer.hidden = false;
        }
        return _chart;
    };

    _chart.getValueAccessorByIndex = function (index) {
        return _stack[index].accessor || _chart.valueAccessor();
    };

    _chart.xAxisMin = function () {
        var min = d3.min(flattenStack(), function (p) {
            return (p.x + p.x0 < p.x0) ? (p.x + p.x0) : p.x0;
        });

        return dc.utils.subtract(min, _chart.xAxisPadding());

    };

    _chart.xAxisMax = function () {
        var max = d3.max(flattenStack(), function (p) {
            return p.x + p.x0;
        });

        return dc.utils.add(max, _chart.xAxisPadding());
    };

    function flattenStack () {
        var valueses = _chart.data().map(function (layer) { return layer.values; });
        return Array.prototype.concat.apply([], valueses);
    }

    _chart.yAxisMin = function () {
        var min = d3.min(flattenStack(), dc.pluck('y'));
        return dc.utils.subtract(min, _chart.yAxisPadding());
    };

    _chart.yAxisMax = function () {
        var max = d3.max(flattenStack(), dc.pluck('y'));
        return dc.utils.add(max, _chart.yAxisPadding());
    };

    /**
     * Set or get the title function. Chart class will use this function to render svg title (usually interpreted by
     * browser as tooltips) for each child element in the chart, i.e. a slice in a pie chart or a bubble in a bubble chart.
     * Almost every chart supports title function however in grid coordinate chart you need to turn off brush in order to
     * use title otherwise the brush layer will block tooltip trigger.
     *
     * If the first argument is a stack name, the title function will get or set the title for that stack. If stackName
     * is not provided, the first stack is implied.
     * @method title
     * @memberof dc.horizontalStackMixin
     * @instance
     * @example
     * // set a title function on 'first stack'
     * chart.title('first stack', function(d) { return d.key + ': ' + d.value; });
     * // get a title function from 'second stack'
     * var secondTitleFunction = chart.title('second stack');
     * @param {String} [stackName]
     * @param {Function} [titleAccessor]
     * @return {String}
     * @return {dc.horizontalStackMixin}
     */
    dc.override(_chart, 'title', function (stackName, titleAccessor) {
        if (!stackName) {
            return _chart._title();
        }

        if (typeof stackName === 'function') {
            return _chart._title(stackName);
        }
        if (stackName === _chart._groupName && typeof titleAccessor === 'function') {
            return _chart._title(titleAccessor);
        }

        if (typeof titleAccessor !== 'function') {
            return _titles[stackName] || _chart._title();
        }

        _titles[stackName] = titleAccessor;

        return _chart;
    });

    /**
     * Gets or sets the stack layout algorithm, which computes a baseline for each stack and
     * propagates it to the next
     * @method stackLayout
     * @memberof dc.horizontalStackMixin
     * @instance
     * @see {@link http://github.com/mbostock/d3/wiki/Stack-Layout d3.layout.stack}
     * @param {Function} [stack=d3.layout.stack]
     * @return {Function}
     * @return {dc.horizontalStackMixin}
     */
    _chart.stackLayout = function (stack) {
        if (!arguments.length) {
            return _stackLayout;
        }
        _stackLayout = stack;
        if (_stackLayout.values() === d3.layout.stack().values()) {
            _stackLayout.values(prepareValues);
        }
        return _chart;
    };

    function visability (l) {
        return !l.hidden;
    }

    function flipXY (layers) {
        return layers.map(function (layer) {
            return {
                group: layer.group,
                name: layer.name,
                accessor: layer.accessor,
                values: layer.values.map(function (value) {
                    return {
                        data: value.data,
                        hidden: value.hidden,
                        layer: value.layer,
                        x: value.y,
                        y: value.x,
                        x0: value.y0
                    };
                })
            };
        });
    }

    _chart.data(function () {
        var layers = _stack.filter(visability);
        if (!layers.length) {
            return [];
        }
        var stackedLayers = _chart.stackLayout()(layers);
        return flipXY(stackedLayers);
    });

    _chart._ordinalYDomain = function () {
        var flat = flattenStack().map(dc.pluck('data'));
        var ordered = _chart._computeOrderedGroups(flat);
        return ordered.map(_chart.keyAccessor());
    };

    _chart.colorAccessor(function (d) {
        var layer = this.layer || this.name || d.name || d.layer;
        return layer;
    });

    _chart.legendables = function () {
        return _stack.map(function (layer, i) {
            return {
                chart: _chart,
                name: layer.name,
                hidden: layer.hidden || false,
                color: _chart.getColor.call(layer, layer.values, i)
            };
        });
    };

    _chart.isLegendableHidden = function (d) {
        var layer = findLayerByName(d.name);
        return layer ? layer.hidden : false;
    };

    _chart.legendToggle = function (d) {
        if (_hidableStacks) {
            if (_chart.isLegendableHidden(d)) {
                _chart.showStack(d.name);
            } else {
                _chart.hideStack(d.name);
            }
            //_chart.redraw();
            _chart.renderGroup();
        }
    };

    return _chart;
};
