define([
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/_base/Color",

    "dojo/cookie",

    "dojo/Deferred",

    "dojo/promise/all",

    "dojo/dom",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/query",

    "dojo/on",
    "dojo/request",

    "esri/geometry/geometryEngine",

    "esri/Graphic",

    "esri/layers/GraphicsLayer",

    "esri/symbols/PictureMarkerSymbol",
    "esri/symbols/SimpleFillSymbol",
    "esri/symbols/SimpleMarkerSymbol",

    "esri/tasks/Locator",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",

    "esri/views/MapView",

    "esri/WebMap",

    "esri/widgets/Search",

    "dojo/domReady!"

], function (
    declare, array, lang, Color,
    cookie,
    Deferred,
    all,
    dom, domClass, domConstruct, domStyle, cssQuery,
    on, request,
    geometryEngine,
    Graphic,
    GraphicsLayer,
    PictureMarkerSymbol, SimpleFillSymbol, SimpleMarkerSymbol,
    Locator, QueryTask, Query,
    MapView,
    WebMap,
    Search
) {
        return declare(null, {

            settings: {},
            subject: null,
            features: [],
            rcoInfo: null,


            // startup
            startup: function (settings) {
                var promise;
                if (settings) {
                    this.settings = settings;
                    this._initApp();
                } else {
                    var error = new Error("Main:: Settings are not defined");
                    this.reportError(error);
                    var def = new Deferred();
                    def.reject(error);
                    promise = def.promise;
                }
                return promise;
            },

            // report error
            reportError: function (error) {
                console.error(error.message);
            },

            // init app
            _initApp: function () {
                this._initSplash();
                this._initMap();
            },

            // ** Splash ** //
            _initSplash: function () {
                var splash = dom.byId('splashScreen');
                var dontShowCheck = dom.byId('doNotShowSplash');
                var clickables = cssQuery('.clickable');

                if (cookie('hideSplashByDefault') === "true") {
                    domStyle.set(splash, "display", "none");
                    domStyle.set(splash, "z-index", -10);
                    dontShowCheck.checked = true;
                }
                else {
                    domStyle.set(splash, "display", "block");
                    domStyle.set(splash, "z-index", 10);
                    dontShowCheck.checked = false;
                }

                on(splash, 'click', function () {
                    domStyle.set(splash, 'display', 'none');
                    domStyle.set(splash, 'z-index', -10)
                });

                clickables.forEach(function (clickable) {
                    on(clickable, 'click', function () {
                        event.stopPropagation();
                    })
                });

                on(dontShowCheck, 'change', function () {
                    if (dontShowCheck.checked) {
                        cookie('hideSplashByDefault', true);
                    }
                    else {
                        cookie('hideSplashByDefault', false);
                    }
                });
            },

            // ** MAP ** //

            // init map
            _initMap: function () {
                console.log(this.settings);
                var webmap = new WebMap({
                    portalItem: {
                        id: this.settings.webmap
                    }
                });
                this._initView(webmap);
            },

            // init view
            _initView: function (webmap) {
                this.view = new MapView({
                    container: "panelMap",
                    map: webmap,
                    ui: {
                        components: ["zoom", "attribution"]
                    }
                });
                this.view.when(lang.hitch(this, function () {
                    this._initLayers();
                    this._initUI();
                    this.view.on("click", lang.hitch(this, this._viewClick));
                    if (this.settings.labelLayer) {
                        this.view.watch("extent", lang.hitch(this, this._extentChange));
                    }
                    this._extentChange();
                }), lang.hitch(this, function () {
                    var error = new Error("Main:: Unable to create scene");
                    this.reportError(error);
                }));
            },

            // init layers
            _initLayers: function () {
                this.lyrParcels = new GraphicsLayer();
                this.view.map.add(this.lyrParcels);
                this.lyrGraphics = new GraphicsLayer();
                this.view.map.add(this.lyrGraphics);
                this.lyrLabels = new GraphicsLayer();
                this.view.map.add(this.lyrLabels);
                if (this.settings.labelLayer) {
                    this.view.map.layers.forEach(lang.hitch(this, function (lyr) {
                        if (lyr.type === "feature") {
                            if (lyr.title === this.settings.labelLayer) {
                                this.lyr = lyr;
                            }
                        }
                    }));
                }
            },

            // view click
            _viewClick: function (evt) {
                this.searchWidget.clear();
                var pt = evt.mapPoint;
                this._selectProperty(pt, false);
            },

            // extent change
            _extentChange: function () {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                }
                this.timer = setTimeout(lang.hitch(this, this._updateLabels), 900);
            },

            // update labels
            _updateLabels: function () {
                this.lyrLabels.removeAll();
                if (this.view.zoom < 18) {
                    return;
                }
                var query = new Query();
                query.num = 2000;
                query.geometry = this.view.extent;
                query.returnGeometry = true;
                query.outFields = ["ADDRESS"];
                this.lyr.queryFeatures(query).when(lang.hitch(this, function (results) {
                    var graphics = [];
                    array.forEach(results.features, lang.hitch(this, function (f) {
                        var txt = f.attributes.ADDRESS.split(" ")[0];
                        var pt = f.geometry.centroid;
                        var sym = {
                            type: "text",
                            color: "#c8c8c8",
                            text: txt,
                            font: {
                                size: 7,
                                family: "sans-serif",
                                weight: "bolder",
                                horizontalAlignment: "center",
                                verticalAlignment: "middle"
                            }
                        };
                        var gra = new Graphic({
                            geometry: pt,
                            symbol: sym
                        });
                        graphics.push(gra);
                    }));
                    this.lyrLabels.addMany(graphics);
                }));
            },


            // ** UI ** //

            // init ui
            _initUI: function () {
                var rgba = [255, 255, 255]; //this.settings.color.slice();
                rgba.push(0.85);
                var color = "rgba(" + rgba.join(",") + ")";
                domStyle.set("panelBox", "background-color", color);
                var sources = [{
                    locator: new Locator({ url: this.settings.locatorUrl }),
                    singleLineFieldName: "Single Line Input",
                    name: "Philly",
                    localSearchOptions: {
                        minScale: 300000,
                        distance: 50000
                    },
                    placeholder: "Enter Address",
                    suggestionsEnabled: true,
                    minSuggestCharacters: 0
                }];
                this.searchWidget = new Search({
                    view: this.view,
                    container: "boxSearch",
                    allPlaceholder: "Enter Address",
                    sources: sources,
                    autoSelect: false
                });
                this.searchWidget.allPlaceholder = "Enter Address";
                on(this.searchWidget, "search-complete", lang.hitch(this, this._searchComplete));
                on(this.searchWidget, "search-clear", lang.hitch(this, this._searchClear));
                on(dom.byId("btnCSV"), "click", lang.hitch(this, this._downloadClick));
                on(dom.byId("btnAbout"), "click", lang.hitch(this, this._toggleAbout));
                on(dom.byId("btnEmail"), "click", lang.hitch(this, this._sendEmail));
                on(dom.byId("btnDwn"), "click", lang.hitch(this, this._downloadRCO));
            },

            // search complete
            _searchComplete: function (evt) {
                if (evt.results.length > 0) {
                    var geoResults = evt.results[0];
                    var results = geoResults.results;
                    if (results.length > 0) {
                        var rec = results[0];
                        var pt = rec.feature.geometry;
                        this._selectProperty(pt, true);
                    }
                }
            },

            // search clear
            _searchClear: function () {
                this._clear();
            },

            // select property
            _selectProperty: function (pt, zoom) {
                this._clear();
                var query = new Query();
                var queryTask = new QueryTask({
                    url: this.settings.parcelsUrl
                });
                query.geometry = pt;
                query.returnGeometry = true;
                query.outFields = ["*"];
                query.outSpatialReference = this.view.spatialReference;
                queryTask.execute(query).then(lang.hitch(this, function (results) {
                    var features = results.features;
                    if (features.length > 0) {
                        var gra = features[0];
                        this._getSubject(gra);
                        this._getCouncil(gra.geometry);
                        this._getRCO(gra.geometry);
                        this._getZIP(gra.geometry);
                        this._bufferProperty(gra.geometry);
                        this._updateSubject();
                    }
                    if (zoom) {
                        this._zoomTo(pt);
                    }
                }));
            },

            // get subject
            _getSubject: function (gra) {
                var attr = this._getAttributes(gra.attributes);
                this.subject = {
                    address: attr[0]
                };
            },

            // get council
            _getCouncil: function (geom) {
                var query = new Query();
                var queryTask = new QueryTask({
                    url: this.settings.councilUrl
                });
                query.geometry = geom;
                query.returnGeometry = false;
                query.outFields = ["*"];
                queryTask.execute(query).then(lang.hitch(this, function (results) {
                    var str = "";
                    var features = results.features;
                    if (features.length > 0) {
                        var list = [];
                        array.forEach(features, function (f) {
                            list.push(f.attributes.DISTRICT);
                        });
                        str = list.join(", ");
                    }
                    this.subject.council = str;
                    this._updateSubject();
                }));
            },

            // get rco
            _getRCO: function (geom) {
                var query = new Query();
                var queryTask = new QueryTask({
                    url: this.settings.rcoUrl
                });
                query.geometry = geom;
                query.returnGeometry = false;
                query.outFields = ["*"];
                queryTask.execute(query).then(lang.hitch(this, function (results) {
                    var str = "";
                    var features = results.features;
                    if (features.length > 0) {
                        var list = [];
                        array.forEach(features, function (f) {
                            list.push(f.attributes.ORGANIZATION_NAME);
                        });
                        str = list.join(", ");
                    }
                    this.subject.rco = str;
                    this.subject.rcoInfo = this._getRCOInfo(features);
                    this._updateSubject();
                }));
            },
            // get rco info
            _getRCOInfo: function (features) {
                var info = "";
                var flds = this.settings.rcoFields;
                info += flds.join(",") + "\n";
                array.forEach(features, function (f) {
                    var attr = f.attributes;
                    for (var i = 0; i < flds.length; i++) {
                        info += "\"" + attr[flds[i]] + "\"";
                        if (i < flds.length - 1) {
                            info += ",";
                        }
                    }
                    info += "\n";
                });

                return info;
            },

            // get zip code
            _getZIP: function (geom) {
                var latLng = [geom.centroid.longitude, geom.centroid.latitude];
                request(`${this.settings.aisApiUrl}${this.settings.aisReverseGeocodePath}${latLng}?gatekeeperKey=${this.settings.gateKeeperKey}`)
                    .then(function (result) {
                        var resultObj = JSON.parse(result);
                        this.subject.ZipCode = resultObj.features[0].properties.zip_code;
                        this._updateSubject();
                    });
            },

            // get zip codes for export features
            _getZipByProperty: function (features) {
                var requestUrl = `${this.settings.aisApiUrl}${this.settings.aisSearchPath}{0}?gatekeeperKey=${this.settings.gateKeeperKey}`;
                var featureQueries = array.map(features,
                    function (feature) {
                        return request.get(requestUrl.replace('{0}', feature.attributes.BRT_ID));
                    });
                var hitchFeatures = this.features;
                return all(featureQueries).then(function (results) {
                    results.forEach(lang.hitch(hitchFeatures, function (result, index) {
                        var str = "";
                        var apiFeatures = JSON.parse(result).features;
                        if (apiFeatures.length > 0) {
                            var list = [];
                            array.forEach(apiFeatures, function (f) {
                                list.push(f.properties.zip_code);
                            });
                            str = list.join(", ");
                            hitchFeatures[index].attributes.CODE = str;
                        }
                    }));
                });
            },

            // update subject
            _updateSubject: function () {
                if (this.subject) {
                    dom.byId("boxSubject").innerHTML = "<span class='fld'>SUBJECT: </span>" + this.subject.address;
                    dom.byId("boxCouncil").innerHTML = "<span class='fld'>COUNCIL DISTRICT: </span>" + this.subject.council;
                    dom.byId("boxRCO").innerHTML = "<span class='fld'>RCO</span>: " + this.subject.rco;
                }
            },

            _getAttributes: function (attr) {
                var addr = attr.ADDRESS || "";
                var city = "Philadelphia";
                var state = "PA";
                var ZIP = attr.CODE || "";
                return [addr, city, state, ZIP];
            },

            // buffer property
            _bufferProperty: function (geom) {
                // subject
                var symSubj = new SimpleFillSymbol({
                    color: [255, 255, 255, 0.5],
                    outline: {
                        color: [255, 0, 0],
                        width: 2
                    }
                });
                var graSubj = new Graphic({
                    geometry: geom,
                    symbol: symSubj
                });
                // buffer
                var buffer = geometryEngine.geodesicBuffer(geom, this.settings.distance, "feet");
                this._selectParcels(buffer);
                var rgba1 = this.settings.color.slice();
                rgba1.push(0.2);
                var rgba2 = this.settings.color.slice();
                rgba2.push(0.4);
                var symBuffer = new SimpleFillSymbol({
                    color: rgba1,
                    outline: {
                        color: rgba2,
                        width: 2
                    }
                });
                var graBuffer = new Graphic({
                    geometry: buffer,
                    symbol: symBuffer
                });
                // centroid
                var pt = buffer.centroid;
                var symPt = new SimpleMarkerSymbol({
                    color: this.settings.color,
                    outline: {
                        color: [0, 0, 0, 0.7],
                        width: 3
                    }
                });
                var graPt = new Graphic({
                    geometry: pt,
                    symbol: symPt
                });
                // marker
                var sym = new PictureMarkerSymbol({
                    url: "images/pin.png",
                    width: "24px",
                    height: "24px"
                });
                var gra = new Graphic({
                    geometry: pt,
                    symbol: sym
                });
                this.lyrGraphics.addMany([graSubj, graBuffer, graPt, gra]);
            },

            // select parcels
            _selectParcels: function (geom) {
                var query = new Query();
                var queryTask = new QueryTask({
                    url: this.settings.parcelsUrl
                });
                query.geometry = geom;
                query.returnGeometry = true;
                query.outFields = ["*"];
                query.orderByFields = ["TENCODE"];
                query.outSpatialReference = this.view.spatialReference;
                queryTask.execute(query).then(lang.hitch(this, function (results) {
                    this.features = results.features;
                    this._updateStats(this.features);
                }));
            },

            // zoom to
            _zoomTo: function (pt) {
                pt.longitude = pt.longitude - .001;
                this.view.goTo({
                    target: pt,
                    zoom: 17
                });
            },

            // update stats
            _updateStats: function (features) {
                // start getting zip codes as soon as property is selected.
                this._getZipByProperty(features);
                dom.byId("boxNum").innerHTML = features.length;
                var style = features.length > 0 ? "block" : "none";
                domStyle.set("boxNum", "display", "block");
                domStyle.set("boxLabel", "display", "block");
                domStyle.set("boxDownload", "display", style);

                var sym = new SimpleFillSymbol({
                    color: [0, 0, 0, 0.15],
                    outline: {
                        color: [0, 0, 0, 0.2],
                        width: 2
                    }
                });
                array.forEach(features, lang.hitch(this, function (gra) {
                    var g = new Graphic({
                        geometry: gra.geometry,
                        symbol: sym
                    });
                    this.lyrParcels.add(g);
                }));
                this._checkHistory();
                domClass.add("boxResults", "opened");
            },

            // clear
            _clear: function () {
                this.features = [];
                this.subject = null;
                this.lyrParcels.removeAll();
                this.lyrGraphics.removeAll();
                dom.byId("boxSubject").innerHTML = "";
                dom.byId("boxCouncil").innerHTML = "";
                dom.byId("boxRCO").innerHTML = "";
                domClass.remove("boxResults", "opened");
            },


            //* CSV *//

            // check history
            _checkHistory: function () {

                var num = 0;
                if (cookie("dwn")) {
                    num = parseInt(cookie("dwn"), 10);
                }
                if (num < 50) {
                    domStyle.set("btnCSV", "display", "block");
                    domStyle.set("btnMax", "display", "none");
                    return true;
                }
                domStyle.set("btnCSV", "display", "none");
                domStyle.set("btnMax", "display", "block");
                return false;
            },

            // update history
            _updateHistory: function () {
                var num = 0;
                if (cookie("dwn")) {
                    num = parseInt(cookie("dwn"), 10);
                }
                num += 1;
                cookie("dwn", num, { expires: 1 });
                if (num >= 50) {
                    domStyle.set("btnCSV", "display", "none");
                    domStyle.set("btnMax", "display", "block");
                }
            },

            // download click
            _downloadClick: function () {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                }
                dom.byId("btnCSV").innerHTML = "Preparing Download...";
                this.timer = setTimeout(lang.hitch(this, this._downloadCSV), 3000);
            },

            _downloadCSV: function () {
                var chk = this._checkHistory();
                if (!chk) {
                    return;
                }
                this._updateHistory();

                var content = '';
                content += "ADDRESS,CITY,STATE,ZIP\n";
                array.forEach(this.features, lang.hitch(this, function (f) {
                    var attr = this._getAttributes(f.attributes);
                    content += attr.join(",") + "\n";
                }));
                var fileName = "NotifyAddressList.csv";
                var mimeType = "application/octet-stream";
                var a = document.createElement('a');
                if (navigator.msSaveBlob) { // IE10
                    navigator.msSaveBlob(new Blob([content], {
                        type: mimeType
                    }), fileName);
                } else if (URL && 'download' in a) { //html5 A[download]
                    a.href = URL.createObjectURL(new Blob([content], {
                        type: mimeType
                    }));
                    a.setAttribute('download', fileName);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    location.href = 'data:application/octet-stream,' + encodeURIComponent(content); // only this mime type is supported
                }
                dom.byId("btnCSV").innerHTML = "DOWNLOAD ADDRESS LIST";
            },

            _downloadRCO: function () {
                var content = this.subject.rcoInfo;
                var fileName = "rco.csv";
                var mimeType = "application/octet-stream";
                var a = document.createElement('a');
                if (navigator.msSaveBlob) { // IE10
                    navigator.msSaveBlob(new Blob([content], {
                        type: mimeType
                    }), fileName);
                } else if (URL && 'download' in a) { //html5 A[download]
                    a.href = URL.createObjectURL(new Blob([content], {
                        type: mimeType
                    }));
                    a.setAttribute('download', fileName);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    location.href = 'data:application/octet-stream,' + encodeURIComponent(content); // only this mime type is supported
                }
            },

            //* ABOUT *//

            // toggle about
            _toggleAbout: function () {
                var splash = dom.byId('splashScreen');

                if (domStyle.get(splash, "display") === "block") {
                    domStyle.set(splash, "display", "none");
                    domStyle.set(splash, "z-index", -10);
                } else {
                    domStyle.set(splash, "display", "block");
                    domStyle.set(splash, "z-index", 10);
                }
            },

            // send email
            _sendEmail: function () {
                var url = "mailto:" + this.settings.email + "?subject=RCO Notification App";
                window.location.href = url;
            }

        });
    });