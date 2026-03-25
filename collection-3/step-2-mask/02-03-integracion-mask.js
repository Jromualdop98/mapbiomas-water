var imageCollection = ee.ImageCollection("projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/02-mask-01-regiones");

var paises = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4");
var pais = paises.filter(ee.Filter.eq('pais', "Perú"));  

for (var i=2024; i<2025; i++) {
  
  var mosaico = imageCollection.filter(ee.Filter.eq('year', i)).mosaic()
            .set("year",i)
            .set("version",1)
            .set("country","PERU")
  
  Export.image.toAsset({
      image: mosaico, 
      description: 'water_' + i + '_1', //+ year + '_' + version_out, 
      assetId: 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/02-mask-01/water_' + i + '_1', //+ region_interes+'_water_' + year + '_' + version_out, 
      // assetId: 'projects/ee-jromualdoibc/assets/02-mask-01/' + region_interes+'_water_' + year + '_' + version_out,
      region: pais.geometry().bounds(), 
      scale: 30,
      pyramidingPolicy: {
          '.default': 'mode'
      },
      maxPixels: 1e13
    });
  
}