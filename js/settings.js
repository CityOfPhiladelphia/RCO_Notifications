define({
    // MAP
    "webmap": "9cf8b14c509649d2b6affce1cfd105e2", //"eba12c7718ca4cb0a84e64e848fb159e",
    "center": [-74.003, 40.69],
    "zoom": 16,
    "color": [37, 206, 247],
    "distance": 250, // buffer distance in feet
    "email": "RCO.Notification@Phila.gov",
    // LOCATOR
    "locatorUrl": "//citygeo-geocoder-pub.databridge.phila.gov/arcgis/rest/services/Geocoders/Address_Locator/GeocodeServer",
    //  LABELS
    "labelLayer": "Parcels",
    // LAYERS
    "parcelsUrl": "//services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/PWD_PARCELS/FeatureServer/0",
    "dorParcelsUrl": "//services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/DOR_Parcel/FeatureServer/0",
    "rcoUrl": "//services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Zoning_RCO/FeatureServer/0",
    "councilUrl": "//services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Council_Districts_2024/FeatureServer/0",
    "cartoOpaPropertiesUrl": "https://phl.carto.com:443/api/v2/sql",
    // FIELDS
    "rcoFields": ["ORGANIZATION_NAME", "PRIMARY_EMAIL", "ORGANIZATION_ADDRESS", "PRIMARY_NAME", "PRIMARY_ADDRESS", "PRIMARY_PHONE"],
    "aisApiUrl" : "//api.phila.gov/ais/v1/",
    "aisReverseGeocodePath": "reverse_geocode/",
    "aisSearchPath": "search/",
    "gateKeeperKey" : "ad1c7f7c6895cd11c1bec0b53f1e1bab"
});
