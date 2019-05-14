"use strict";

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
    "esri/geometry/Point",
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
    declare,
    array,
    lang,
    Color,
    cookie,
    Deferred,
    all,
    dom,
    domClass,
    domConstruct,
    domStyle,
    cssQuery,
    on,
    request,
    geometryEngine,
    Point,
    Graphic,
    GraphicsLayer,
    PictureMarkerSymbol,
    SimpleFillSymbol,
    SimpleMarkerSymbol,
    Locator,
    QueryTask,
    Query,
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
            startup: function startup(settings) {
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
            reportError: function reportError(error) {
                console.error(error.message);
            },
            // init app
            _initApp: function _initApp() {
                this._initSplash();

                this._initMap();
            },
            // ** Splash ** //
            _initSplash: function _initSplash() {
                var splash = dom.byId("splashScreen");
                var dontShowCheck = dom.byId("doNotShowSplash");
                var clickables = cssQuery(".clickable");

                if (cookie("hideSplashByDefault") === "true") {
                    domStyle.set(splash, "display", "none");
                    domStyle.set(splash, "z-index", -10);
                    dontShowCheck.checked = true;
                } else {
                    domStyle.set(splash, "display", "block");
                    domStyle.set(splash, "z-index", 10);
                    dontShowCheck.checked = false;
                }

                on(splash, "click", function () {
                    domStyle.set(splash, "display", "none");
                    domStyle.set(splash, "z-index", -10);
                });
                clickables.forEach(function (clickable) {
                    on(clickable, "click", function () {
                        event.stopPropagation();
                    });
                });
                on(dontShowCheck, "change", function () {
                    if (dontShowCheck.checked) {
                        cookie("hideSplashByDefault", true);
                    } else {
                        cookie("hideSplashByDefault", false);
                    }
                });
            },
            // ** MAP ** //
            // init map
            _initMap: function _initMap() {
                var webmap = new WebMap({
                    portalItem: {
                        id: this.settings.webmap
                    }
                });

                this._initView(webmap);
            },
            // init view
            _initView: function _initView(webmap) {
                this.view = new MapView({
                    container: "panelMap",
                    map: webmap,
                    ui: {
                        components: ["zoom", "attribution"]
                    }
                });
                this.view.when(
                    lang.hitch(this, function () {
                        this._initLayers();

                        this._initUI();

                        this.view.on("click", lang.hitch(this, this._viewClick));

                        if (this.settings.labelLayer) {
                            this.view.watch("extent", lang.hitch(this, this._extentChange));
                        }

                        this._extentChange();
                    }),
                    lang.hitch(this, function () {
                        var error = new Error("Main:: Unable to create scene");
                        this.reportError(error);
                    })
                );
            },
            // init layers
            _initLayers: function _initLayers() {
                this.lyrParcels = new GraphicsLayer();
                this.view.map.add(this.lyrParcels);
                this.lyrGraphics = new GraphicsLayer();
                this.view.map.add(this.lyrGraphics);
                this.lyrLabels = new GraphicsLayer();
                this.view.map.add(this.lyrLabels);

                if (this.settings.labelLayer) {
                    this.view.map.layers.forEach(
                        lang.hitch(this, function (lyr) {
                            if (lyr.type === "feature") {
                                if (lyr.title === this.settings.labelLayer) {
                                    this.lyr = lyr;
                                }
                            }
                        })
                    );
                }
            },
            // view click
            _viewClick: function _viewClick(evt) {
                this.searchWidget.clear();
                var pt = evt.mapPoint;

                this._selectProperty(pt, false);
            },
            // extent change
            _extentChange: function _extentChange() {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                }

                this.timer = setTimeout(lang.hitch(this, this._updateLabels), 900);
            },
            // update labels
            _updateLabels: function _updateLabels() {
                this.lyrLabels.removeAll();

                if (this.view.zoom < 18) {
                    return;
                }

                var query = new Query();
                query.num = 2000;
                query.geometry = this.view.extent;
                query.returnGeometry = true;
                query.outFields = ["ADDRESS"];
                this.lyr.queryFeatures(query).then(
                    lang.hitch(this, function (results) {
                        var graphics = [];
                        array.forEach(
                            results.features,
                            lang.hitch(this, function (f) {
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
                            })
                        );
                        this.lyrLabels.addMany(graphics);
                    })
                );
            },
            // ** UI ** //
            // init ui
            _initUI: function _initUI() {
                var rgba = [255, 255, 255]; //this.settings.color.slice();

                rgba.push(0.85);
                var color = "rgba(" + rgba.join(",") + ")";
                domStyle.set("panelBox", "background-color", color);
                var sources = [
                    {
                        locator: new Locator({
                            url: this.settings.locatorUrl
                        }),
                        singleLineFieldName: "Single Line Input",
                        name: "City Geocoder",
                        localSearchOptions: {
                            minScale: 300000,
                            distance: 50000
                        },
                        placeholder: "Enter Address",
                        suggestionsEnabled: true,
                        minSuggestCharacters: 0
                    }
                ];
                this.searchWidget = new Search({
                    view: this.view,
                    container: "boxSearch",
                    allPlaceholder: "Enter Address",
                    sources: sources,
                    autoSelect: false,
                    includeDefaultSources: false,
                    locationEnabled: false
                });
                this.searchWidget.allPlaceholder = "Enter Address";
                on(
                    this.searchWidget,
                    "search-complete",
                    lang.hitch(this, this._searchComplete)
                );
                on(
                    this.searchWidget,
                    "search-clear",
                    lang.hitch(this, this._searchClear)
                );
                on(dom.byId("btnCSV"), "click", lang.hitch(this, this._downloadClick));
                on(dom.byId("btnAbout"), "click", lang.hitch(this, this._toggleAbout));
                on(dom.byId("btnEmail"), "click", lang.hitch(this, this._sendEmail));
                on(dom.byId("btnDwn"), "click", lang.hitch(this, this._downloadRCO));
            },
            // search complete
            _searchComplete: function _searchComplete(evt) {
                if (evt.results.length > 0) {
                    var geoResults = evt.results[0];
                    var results = geoResults.results;

                    if (results.length > 0) {
                        var rankedResults = results.map(function (result) {
                            var rank;
                            if (result.name === evt.searchTerm && result.name.indexOf(",") >= 0) {
                                rank = 1;
                            }
                            else if (result.name.indexOf(evt.searchTerm) >= 0) {
                                rank = 2;
                            }
                            else if (result.name.indexOf(",") >= 0) {
                                rank = 3;
                            }
                            else {
                                rank = 4;
                            }

                            result.rank = rank;
                            return result;
                        });
                        var rec = rankedResults.slice(0).sort(function (a, b) {
                            return a.rank - b.rank;
                        })[0];
                        var pt = rec.feature.geometry;

                        this._selectProperty(pt, true, rec);
                    } else {
                        request(
                            this.settings.aisApiUrl +
                            this.settings.aisSearchPath +
                            evt.searchTerm +
                            "?gatekeeperKey=" +
                            this.settings.gateKeeperKey
                        ).then(
                            lang.hitch(this, function (result) {
                                var rec = JSON.parse(result);
                                var pt = new Point(rec.features[0].geometry.coordinates);

                                this._searchWithAisInfo(pt, rec, true);
                            })
                        );
                    }
                }
            },
            // search clear
            _searchClear: function _searchClear() {
                this._clear();
            },
            // select property
            _selectProperty: function _selectProperty(pt, zoom, searchResult) {
                var latLng = [pt.longitude, pt.latitude];
                request(
                    this.settings.aisApiUrl +
                    this.settings.aisSearchPath +
                    ((searchResult && searchResult.name) || latLng) +
                    "?gatekeeperKey=" +
                    this.settings.gateKeeperKey
                ).then(
                    // found
                    lang.hitch(this, function (result) {
                        var aisResult = JSON.parse(result);

                        this._searchWithAisInfo(pt, aisResult, zoom);
                    }),
                    // not found
                    lang.hitch(this, function (error) {
                        this._searchWithAisInfo(pt, undefined, zoom);
                    })
                );
            },
            _searchWithAisInfo: function _searchWithAisInfo(pt, aisResult, zoom) {
                this._clear();

                var aisFeature =
                    aisResult &&
                    aisResult.features.filter(function (i) {
                        return i.match_type === "exact";
                    })[0];

                this._getAgoData(aisFeature, true, pt);

                if (zoom) {
                    this._zoomTo(pt);
                }
            },
            _getAgoData: function _getAgoData(aisFeature, pwd, pt) {
                var query = new Query();
                var queryTask = new QueryTask({
                    url: pwd ? this.settings.parcelsUrl : this.settings.dorParcelsUrl
                });

                if (
                    aisFeature &&
                    (pwd
                        ? aisFeature.properties.opa_account_num
                        : aisFeature.properties.dor_parcel_id)
                ) {
                    query.where = pwd
                        ? "BRT_ID=" + "'" + aisFeature.properties.opa_account_num + "'"
                        : "MAPREG=" + "'" + aisFeature.properties.dor_parcel_id + "'";
                } else {
                    query.geometry = pt;
                }

                query.returnGeometry = true;
                query.outFields = pwd
                    ? ["ADDRESS", "TENCODE"]
                    : ["ADDR_SOURCE", "STCOD", "HOUSE"];
                query.outSpatialReference = this.view.spatialReference;
                queryTask.execute(query).then(
                    lang.hitch(this, function (agoResult) {
                        var agoFeature = agoResult.features[0];

                        if (agoFeature) {
                            this._getSubject(aisFeature, agoFeature);

                            this._getCouncil(agoFeature.geometry);

                            this._getRCO(agoFeature.geometry);

                            var tenCode =
                                (aisFeature && aisFeature.properties.pwd_account_nums[0]) ||
                                agoFeature.attributes.TENCODE ||
                                "" +
                                agoFeature.attributes.STCOD +
                                ("00000" + agoFeature.attributes.HOUSE).slice(-5);

                            this._bufferProperty(agoFeature.geometry, tenCode);

                            this._updateSubject();
                        } else {
                            this._getAgoData(aisFeature, false, pt);
                        }
                    })
                );
            },
            // get subject
            _getSubject: function _getSubject(ais, ago) {
                ais = ais || {
                    properties: []
                };
                var mergedAttributes = [ais.properties, ago.attributes].reduce(function (
                    r,
                    o
                ) {
                    Object.keys(o).forEach(function (k) {
                        r[k] = o[k];
                    });
                    return r;
                },
                    {});

                var attr = this._getAttributes(mergedAttributes);

                this.subject = {
                    address: attr[0]
                };
            },
            // get council
            _getCouncil: function _getCouncil(geom) {
                var query = new Query();
                var queryTask = new QueryTask({
                    url: this.settings.councilUrl
                });
                query.geometry = geom;
                query.returnGeometry = false;
                query.outFields = ["DISTRICT"];
                queryTask.execute(query).then(
                    lang.hitch(this, function (results) {
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
                    })
                );
            },
            // get rco
            _getRCO: function _getRCO(geom) {
                var query = new Query();
                var queryTask = new QueryTask({
                    url: this.settings.rcoUrl
                });
                query.geometry = geom;
                query.returnGeometry = false;
                query.outFields = this.settings.rcoFields;
                queryTask.execute(query).then(
                    lang.hitch(this, function (results) {
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
                    })
                );
            },
            // get rco info
            _getRCOInfo: function _getRCOInfo(features) {
                var info = "";
                var flds = this.settings.rcoFields;
                info += flds.join(",") + "\n";
                array.forEach(features, function (f) {
                    var attr = f.attributes;

                    for (var i = 0; i < flds.length; i++) {
                        info += '"' + attr[flds[i]] + '"';

                        if (i < flds.length - 1) {
                            info += ",";
                        }
                    }

                    info += "\n";
                });
                return info;
            },
            // update subject
            _updateSubject: function _updateSubject() {
                if (this.subject) {
                    dom.byId("boxSubject").innerHTML =
                        "<span class='fld'>SUBJECT: </span>" + this.subject.address;
                    dom.byId("boxCouncil").innerHTML =
                        "<span class='fld'>COUNCIL DISTRICT: </span>" + this.subject.council;
                    dom.byId("boxRCO").innerHTML =
                        "<span class='fld'>RCO</span>: " + this.subject.rco;
                }
            },
            _getAttributes: function _getAttributes(attr) {
                var addr = attr.ADDRESS || attr.street_address || "";
                if (attr.unit) {
                    var truncatedUnit = attr.unit.replace(/^0+/, '');
                    addr += " " + truncatedUnit;
                }

                var city = "Philadelphia";
                var state = "PA";
                var ZIP = (attr.zip_code ? attr.zip_code.substring(0, 5) : "") || "";
                return [addr, city, state, ZIP];
            },
            // buffer property
            _bufferProperty: function _bufferProperty(geom, tenCode) {
                var buffer = geometryEngine.geodesicBuffer(
                    geom,
                    this.settings.distance,
                    "feet"
                );

                this._selectParcels(geom, buffer, tenCode);
            },
            // draw
            _draw: function _draw(subject, buffer, notifyGeom) {
                // subject
                var symSubj = new SimpleFillSymbol({
                    color: [255, 255, 255, 0.5],
                    outline: {
                        color: [255, 0, 0],
                        width: 2
                    }
                });
                var graSubj = new Graphic({
                    geometry: subject,
                    symbol: symSubj
                }); // buffer

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
                }); // centroid

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
                }); // marker

                var sym = new PictureMarkerSymbol({
                    url: "images/pin.png",
                    width: "24px",
                    height: "24px"
                });
                var gra = new Graphic({
                    geometry: pt,
                    symbol: sym
                });
                var notifySymbol = new SimpleFillSymbol({
                    color: [255, 0, 0, 0.1],
                    outline: {
                        color: [0, 0, 0, 0.7],
                        width: 1
                    }
                });
                var graSelected = new Graphic({
                    geometry: notifyGeom,
                    symbol: notifySymbol
                }); // buffer

                this.lyrGraphics.addMany([graSelected, graSubj, graBuffer, graPt, gra]);

                this._extentChange();
            },
            // select parcels
            _selectParcels: function _selectParcels(subject, geom, tenCode) {
                var byGeom,
                    byBlock,
                    queries = [];
                this.features = [];
                var block = tenCode.substring(0, 8);
                var pwdQuery = new Query();
                var pwdQueryTask = new QueryTask({
                    url: this.settings.parcelsUrl
                });
                var blockQuery = new Query();
                var blockQueryTask = new QueryTask({
                    url: this.settings.parcelsUrl
                });
                pwdQuery.geometry = geom;
                blockQuery.where = "TENCODE LIKE '" + block + "__'";
                pwdQuery.returnGeometry = blockQuery.returnGeometry = true;
                pwdQuery.outFields = blockQuery.outFields = ["ADDRESS,BRT_ID", "NUM_ACCOUNTS"];
                pwdQuery.outSpatialReference = this.view.spatialReference;
                byGeom = pwdQueryTask.execute(pwdQuery);
                byBlock = blockQueryTask.execute(blockQuery);
                queries = new all([byGeom, byBlock]);
                queries.then(
                    lang.hitch(this, function (resultSet) {
                        var results = distinctArray(
                            resultSet[0].features.concat(resultSet[1].features)
                        );
                        var notifyGeom = geometryEngine.union(
                            results.map(function (feature) {
                                return feature.geometry;
                            })
                        );

                        this._draw(subject, geom, notifyGeom);

                        var opaQuery = new Query();
                        var opaQueryTask = new QueryTask({
                            url: this.settings.opaPropertiesUrl
                        });

                        var whereClause =
                            "PARCEL_NUMBER IN (" +
                            results
                                .map(function (x) {
                                    return "'" + x.attributes.BRT_ID + "'";
                                })
                                .join(",") +
                            ")";
                            
                        var condos = results.filter(function (i) {
                            return i.attributes.NUM_ACCOUNTS > 1;
                        });

                        if (condos.length > 0) {
                            whereClause +=
                                " OR LOCATION IN (" +
                                condos
                                    .map(function (x) {
                                        return "'" + x.attributes.ADDRESS + "'";
                                    })
                                    .join(",") +
                                ")";
                        }

                        opaQuery.where = whereClause;


                        opaQuery.returnGeometry = false;
                        opaQuery.outFields = ["PARCEL_NUMBER,LOCATION,ZIP_CODE,UNIT"];
                        opaQuery.outSpatialReference = this.view.spatialReference;
                        opaQueryTask.execute(opaQuery).then(
                            lang.hitch(this, function (opaResults) {
                                this.features = opaResults.features.map(function (feature) {
                                    return {
                                        attributes: {
                                            street_address: feature.attributes.LOCATION,
                                            parcel_number: feature.attributes.PARCEL_NUMBER,
                                            zip_code: feature.attributes.ZIP_CODE,
                                            unit: feature.attributes.UNIT
                                        }
                                    };
                                });

                                this._updateStats(this.features);
                            })
                        );
                    })
                );
            },
            // zoom to
            _zoomTo: function _zoomTo(pt) {
                pt.longitude = pt.longitude - 0.001;
                this.view.goTo({
                    target: pt,
                    zoom: 17
                });
            },
            // update stats
            _updateStats: function _updateStats(features) {
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
                array.forEach(
                    features,
                    lang.hitch(this, function (gra) {
                        var g = new Graphic({
                            geometry: gra.geometry,
                            symbol: sym
                        });
                        this.lyrParcels.add(g);
                    })
                );

                this._checkHistory();

                domClass.add("boxResults", "opened");
            },
            // clear
            _clear: function _clear() {
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
            _checkHistory: function _checkHistory() {
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
            _updateHistory: function _updateHistory() {
                var num = 0;

                if (cookie("dwn")) {
                    num = parseInt(cookie("dwn"), 10);
                }

                num += 1;
                cookie("dwn", num, {
                    expires: 1
                });

                if (num >= 50) {
                    domStyle.set("btnCSV", "display", "none");
                    domStyle.set("btnMax", "display", "block");
                }
            },
            // download click
            _downloadClick: function _downloadClick() {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                }

                dom.byId("btnCSV").innerHTML = "Preparing Download...";
                this.timer = setTimeout(lang.hitch(this, this._downloadCSV), 3000);
            },
            _downloadCSV: function _downloadCSV() {
                var chk = this._checkHistory();

                if (!chk) {
                    return;
                }

                this._updateHistory();

                var content = "";
                content += "ADDRESS,CITY,STATE,ZIP\n";
                array.forEach(
                    this.features,
                    lang.hitch(this, function (f) {
                        var attr = this._getAttributes(f.attributes);

                        content += attr.join(",") + "\n";
                    })
                );
                var fileName = "NotifyAddressList.csv";
                var mimeType = "application/octet-stream";
                var a = document.createElement("a");

                if (navigator.msSaveBlob) {
                    // IE10
                    navigator.msSaveBlob(
                        new Blob([content], {
                            type: mimeType
                        }),
                        fileName
                    );
                } else if (URL && "download" in a) {
                    //html5 A[download]
                    a.href = URL.createObjectURL(
                        new Blob([content], {
                            type: mimeType
                        })
                    );
                    a.setAttribute("download", fileName);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    location.href =
                        "data:application/octet-stream," + encodeURIComponent(content); // only this mime type is supported
                }

                dom.byId("btnCSV").innerHTML = "DOWNLOAD ADDRESS LIST";
            },
            _downloadRCO: function _downloadRCO() {
                var content = this.subject.rcoInfo;
                var fileName = "rco.csv";
                var mimeType = "application/octet-stream";
                var a = document.createElement("a");

                if (navigator.msSaveBlob) {
                    // IE10
                    navigator.msSaveBlob(
                        new Blob([content], {
                            type: mimeType
                        }),
                        fileName
                    );
                } else if (URL && "download" in a) {
                    //html5 A[download]
                    a.href = URL.createObjectURL(
                        new Blob([content], {
                            type: mimeType
                        })
                    );
                    a.setAttribute("download", fileName);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    location.href =
                        "data:application/octet-stream," + encodeURIComponent(content); // only this mime type is supported
                }
            },
            //* ABOUT *//
            // toggle about
            _toggleAbout: function _toggleAbout() {
                var splash = dom.byId("splashScreen");

                if (domStyle.get(splash, "display") === "block") {
                    domStyle.set(splash, "display", "none");
                    domStyle.set(splash, "z-index", -10);
                } else {
                    domStyle.set(splash, "display", "block");
                    domStyle.set(splash, "z-index", 10);
                }
            },
            // send email
            _sendEmail: function _sendEmail() {
                var url =
                    "mailto:" + this.settings.email + "?subject=RCO Notification App";
                window.location.href = url;
            }
        });
    });

function distinctArray(array) {
    var a = array.concat();

    for (var i = 0; i < a.length; ++i) {
        for (var j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j]) a.splice(j--, 1);
        }
    }

    return a;
}
