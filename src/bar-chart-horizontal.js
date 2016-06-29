/**
 * Concrete horizontal bar chart/histogram implementation.
 *
 * Examples:
 * - {@link http://dc-js.github.com/dc.js/ Nasdaq 100 Index}
 * - {@link http://dc-js.github.com/dc.js/crime/index.html Canadian City Crime Stats}
 * @class barChart
 * @memberof dc
 * @mixes dc.stackMixin
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a bar chart under #chart-container1 element using the default global chart group
 * var chart1 = dc.barChart('#chart-container1');
 * // create a bar chart under #chart-container2 element using chart group A
 * var chart2 = dc.barChart('#chart-container2', 'chartGroupA');
 * // create a sub-chart under a composite parent chart
 * var chart3 = dc.barChart(compositeChart);
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * {@link https://github.com/mbostock/d3/wiki/Selections#selecting-elements d3 single selector}
 * specifying a dom block element such as a div; or a dom element or d3 selection.  If the bar
 * chart is a sub-chart in a {@link dc.compositeChart Composite Chart} then pass in the parent
 * composite chart instance instead.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @return {dc.barChart}
 */
dc.barChartHorizontal = function (parent, chartGroup) {
    var MIN_BAR_HEIGHT = 1;
    var DEFAULT_GAP_BETWEEN_BARS = 2;
    var LABEL_PADDING = 3;

    var _chart = dc.horizontalStackMixin(dc.horizontalCoordinateGridMixin({}));

    var _gap = DEFAULT_GAP_BETWEEN_BARS;
    var _centerBar = false;
    var _alwaysUseRounding = false;

    var _barHeight;
    var _dyOffset = '0.35em';  // this helps center labels https://github.com/mbostock/d3/wiki/SVG-Shapes#svg_text

    dc.override(_chart, 'rescale', function () {
        _chart._rescale();
        _barHeight = undefined;
        return _chart;
    });

    dc.override(_chart, 'render', function () {
        if (_chart.round() && _centerBar && !_alwaysUseRounding) {
            dc.logger.warn('By default, brush rounding is disabled if bars are centered. ' +
                         'See dc.js bar chart API documentation for details.');
        }

        return _chart._render();
    });

    _chart.label(function (d) {
        return dc.utils.printSingleValue((d.x0 || 0) + d.x);
    }, false);

    _chart.plotData = function () {
        var layers = _chart.chartBodyG().selectAll('g.stack')
            .data(_chart.data());

        calculateBarHeight();

        layers
            .enter()
            .append('g')
            .attr('class', function (d, i) {
                return 'stack ' + '_' + i;
            });

        var last = layers.size() - 1;
        layers.each(function (d, i) {
            var layer = d3.select(this);

            renderBars(layer, i, d);

            if (_chart.renderLabel() && last === i) {
                renderLabels(layer, i, d);
            }
        });
    };

    function barWidth (d) {
        var x = dc.utils.safeNumber(Math.abs(_chart.x()(d.x + (d.x0 || 0)) - _chart.x()((d.x0 || 0))));
        // console.log("(d.x0 || 0): ", (d.x0 || 0), x, d.x);
        // debugger;
        // return dc.utils.safeNumber(Math.abs(d.x));
        return x;
    }

    function renderLabels (layer, layerIndex, d) {
        var labels = layer.selectAll('text.barLabel')
            .data(d.values, dc.pluck('y')); // TODO - is this right to flip

        labels.enter()
            .append('text')
            .attr('class', 'barLabel')
            .attr('dy', _dyOffset)
            .attr('text-anchor', 'start');

        if (_chart.isOrdinal()) {
            labels.on('click', _chart.onClick);
            labels.attr('cursor', 'pointer');
        }

        dc.transition(labels, _chart.transitionDuration())
            .attr('y', function (d) {
                var y = _chart.y()(d.y);
                if (!_centerBar) {
                    y += _barHeight / 2;
                }
                return dc.utils.safeNumber(y);
            })
            .attr('x', function (d) {
                var x = _chart.x()(d.x + (d.x0 || 0));

                if (d.x < 0) {
                    x -= barWidth(d);
                }

                return dc.utils.safeNumber(x + LABEL_PADDING);
            })
            .text(function (d) {
                return _chart.label()(d);
            });

        dc.transition(labels.exit(), _chart.transitionDuration())
            .attr('width', 0)
            .remove();
    }

    function renderBars (layer, layerIndex, d) {
        var bars = layer.selectAll('rect.bar')
            .data(d.values, dc.pluck('y')); // TODO - is this right to flip

        var enter = bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('fill', dc.pluck('data', _chart.getColor))
            .attr('x', 0)
            .attr('width', 0);

        if (_chart.renderTitle()) {
            enter.append('title').text(dc.pluck('data', _chart.title(d.name)));
        }

        if (_chart.isOrdinal()) {
            bars.on('click', _chart.onClick);
        }

        dc.transition(bars, _chart.transitionDuration())
            .attr('y', function (d) {
                var y = _chart.y()(d.y);
                if (_centerBar) {
                    y -= _barHeight / 2;
                }
                if (_chart.isOrdinal() && _gap !== undefined) {
                    y += _gap / 2;
                }
                return dc.utils.safeNumber(y);
            })
            .attr('x', function (d) {
                console.log('d.x', d.x, 'd.x0', d.x0);
                var x = _chart.x()(d.x0);

                if (d.x < 0) {
                    x -= barWidth(d);
                }

                return dc.utils.safeNumber(x);
            })
            .attr('height', _barHeight)
            .attr('width', function (d) {
                return barWidth(d);
            })
            .attr('fill', dc.pluck('data', _chart.getColor))
            .select('title').text(dc.pluck('data', _chart.title(d.name)));

        dc.transition(bars.exit(), _chart.transitionDuration())
            .attr('width', 0)
            .remove();
    }

    function calculateBarHeight () {
        if (_barHeight === undefined) {
            var numberOfBars = _chart.yUnitCount();

            // please can't we always use rangeBands for bar charts?
            if (_chart.isOrdinal() && _gap === undefined) {
                _barHeight = Math.floor(_chart.y().rangeBand());
            } else if (_gap) {
                _barHeight = Math.floor((_chart.yAxisHeight() - (numberOfBars - 1) * _gap) / numberOfBars);
            } else {
                _barHeight = Math.floor(_chart.yAxisHeight() / (1 + _chart.barPadding()) / numberOfBars);
            }

            if (_barHeight === Infinity || isNaN(_barHeight) || _barHeight < MIN_BAR_HEIGHT) {
                _barHeight = MIN_BAR_HEIGHT;
            }
        }
    }

    _chart.fadeDeselectedArea = function () {
        var bars = _chart.chartBodyG().selectAll('rect.bar');
        var extent = _chart.brush().extent();

        if (_chart.isOrdinal()) {
            if (_chart.hasFilter()) {
                bars.classed(dc.constants.SELECTED_CLASS, function (d) {
                    return _chart.hasFilter(d.y);
                });
                bars.classed(dc.constants.DESELECTED_CLASS, function (d) {
                    return !_chart.hasFilter(d.y);
                });
            } else {
                bars.classed(dc.constants.SELECTED_CLASS, false);
                bars.classed(dc.constants.DESELECTED_CLASS, false);
            }
        } else {
            if (!_chart.brushIsEmpty(extent)) {
                var start = extent[0];
                var end = extent[1];

                bars.classed(dc.constants.DESELECTED_CLASS, function (d) {
                    return d.y < start || d.y >= end;
                });
            } else {
                bars.classed(dc.constants.DESELECTED_CLASS, false);
            }
        }
    };

    /**
     * Whether the bar chart will render each bar centered around the data position on the y-axis.
     * @method centerBar
     * @memberof dc.barChart
     * @instance
     * @param {Boolean} [centerBar=false]
     * @return {Boolean}
     * @return {dc.barChart}
     */
    _chart.centerBar = function (centerBar) {
        if (!arguments.length) {
            return _centerBar;
        }
        _centerBar = centerBar;
        return _chart;
    };

    dc.override(_chart, 'onClick', function (d) {
        _chart._onClick(d.data);
    });

    /**
     * Get or set the spacing between bars as a fraction of bar size. Valid values are between 0-1.
     * Setting this value will also remove any previously set {@link dc.barChart#gap gap}. See the
     * {@link https://github.com/mbostock/d3/wiki/Ordinal-Scales#wiki-ordinal_rangeBands d3 docs}
     * for a visual description of how the padding is applied.
     * @method barPadding
     * @memberof dc.barChart
     * @instance
     * @param {Number} [barPadding=0]
     * @return {Number}
     * @return {dc.barChart}
     */
    _chart.barPadding = function (barPadding) {
        if (!arguments.length) {
            return _chart._rangeBandPadding();
        }
        _chart._rangeBandPadding(barPadding);
        _gap = undefined;
        return _chart;
    };

    _chart._useOuterPadding = function () {
        return _gap === undefined;
    };

    /**
     * Get or set the outer padding on an ordinal bar chart. This setting has no effect on non-ordinal charts.
     * Will pad the width by `padding * barWidth` on each side of the chart.
     * @method outerPadding
     * @memberof dc.barChart
     * @instance
     * @param {Number} [padding=0.5]
     * @return {Number}
     * @return {dc.barChart}
     */
    _chart.outerPadding = _chart._outerRangeBandPadding;

    /**
     * Manually set fixed gap (in px) between bars instead of relying on the default auto-generated
     * gap.  By default the bar chart implementation will calculate and set the gap automatically
     * based on the number of data points and the length of the x axis.
     * @method gap
     * @memberof dc.barChart
     * @instance
     * @param {Number} [gap=2]
     * @return {Number}
     * @return {dc.barChart}
     */
    _chart.gap = function (gap) {
        if (!arguments.length) {
            return _gap;
        }
        _gap = gap;
        return _chart;
    };

    _chart.extendBrush = function () {
        var extent = _chart.brush().extent();
        if (_chart.round() && (!_centerBar || _alwaysUseRounding)) {
            extent[0] = extent.map(_chart.round())[0];
            extent[1] = extent.map(_chart.round())[1];

            _chart.chartBodyG().select('.brush')
                .call(_chart.brush().extent(extent));
        }

        return extent;
    };

    /**
     * Set or get whether rounding is enabled when bars are centered. If false, using
     * rounding with centered bars will result in a warning and rounding will be ignored.  This flag
     * has no effect if bars are not {@link dc.barChart#centerBar centered}.
     * When using standard d3.js rounding methods, the brush often doesn't align correctly with
     * centered bars since the bars are offset.  The rounding function must add an offset to
     * compensate, such as in the following example.
     * @method alwaysUseRounding
     * @memberof dc.barChart
     * @instance
     * @example
     * chart.round(function(n) { return Math.floor(n) + 0.5; });
     * @param {Boolean} [alwaysUseRounding=false]
     * @return {Boolean}
     * @return {dc.barChart}
     */
    _chart.alwaysUseRounding = function (alwaysUseRounding) {
        if (!arguments.length) {
            return _alwaysUseRounding;
        }
        _alwaysUseRounding = alwaysUseRounding;
        return _chart;
    };

    function colorFilter (color, inv) {
        return function () {
            var item = d3.select(this);
            var match = item.attr('fill') === color;
            return inv ? !match : match;
        };
    }

    _chart.legendHighlight = function (d) {
        if (!_chart.isLegendableHidden(d)) {
            _chart.g().selectAll('rect.bar')
                .classed('highlight', colorFilter(d.color))
                .classed('fadeout', colorFilter(d.color, true));
        }
    };

    _chart.legendReset = function () {
        _chart.g().selectAll('rect.bar')
            .classed('highlight', false)
            .classed('fadeout', false);
    };

    dc.override(_chart, 'yAxisMax', function () {
        var max = this._yAxisMax();
        if ('resolution' in _chart.yUnits()) {
            var res = _chart.yUnits().resolution;
            max += res;
        }
        return max;
    });

    return _chart.anchor(parent, chartGroup);
};
