// Parametros

// var years = [2011,2017,2020];
var years = ee.List.sequence(2023,2024).getInfo()
var month = 'w_8'   // visualizacion 
var pal = ['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00','f7c504','000000']

// --------------------------------------------------------------------------------------------------------------------------   
// Limites 

var paises = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4");
var pais = paises.filter(ee.Filter.eq('pais', 'Perú'));  

var Mask = ee.Image("projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/RASTERS/regiones_agua_c2")

var Andes = Mask.gte(1310).and(Mask.lte(1322)).selfMask()
var andes_norte = Mask.gte(1310).and(Mask.lte(1317)).selfMask()      
var andes_glaciares = Mask.eq(1318).selfMask()
var andes_sur = Mask.gte(1319).and(Mask.lte(1322)).selfMask()  

// --------------------------------------------------------------------------------------------------------------------------   
// Funciones para obtener las geometrias guardadas en distintas carpetas

function list_folder_to_featColl(e) {
  var path = e.id;
  var fc = ee.FeatureCollection(path)

  return fc; 
}

var getfeacollFolder = function(folder_geo){
    var lista1 = ee.data.listAssets(folder_geo)
    var listaAsset1 = lista1['assets']
    var list = listaAsset1.map(list_folder_to_featColl);
    list = ee.FeatureCollection(list).flatten();
    
    if(lista1.nextPageToken !== null){
      var lista2 = ee.data.listAssets(folder, {pageToken: lista1.nextPageToken})
      var listaAsset2 = lista2['assets']
      
      var list2 = listaAsset2.map(list_folder_to_featColl);
      list2 = ee.FeatureCollection(list2).flatten();
      list =list.merge(list2)
    }
    return list
}

// --------------------------------------------------------------------------------------------------------------------------   
// Geometrias recolectadas Coleccion 3

var folder_geometrias = 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/AUXILIARY-DATA/VECTOR/GEOMETRIAS-REMAP-03';

var feaCollGeo = getfeacollFolder(folder_geometrias);

feaCollGeo = feaCollGeo.map(function(f) {
            return f.set('geo_type', f.geometry().type())
          });

var feaCollGeo_Polygon = feaCollGeo.filter(ee.Filter.eq('geo_type', 'Polygon'))

var inclusionSHP = feaCollGeo_Polygon.filter(ee.Filter.eq('type', 'inclusion'));
var exclusionSHP = feaCollGeo_Polygon.filter(ee.Filter.eq('type', 'exclusion'));
var no_detecSHP = feaCollGeo_Polygon.filter(ee.Filter.eq('type', 'no_detec'));


function inclus_exclu (inclu, exclu, no_detec){
        var inclusionRegions=  ee.FeatureCollection(inclu).reduceToImage(['value'], ee.Reducer.first())
                      .eq(1)
        var exclusionRegions=  ee.FeatureCollection(exclu).reduceToImage(['value'], ee.Reducer.first())
                      .eq(1)
        var no_detecRegions=  ee.FeatureCollection(no_detec).reduceToImage(['value'], ee.Reducer.first())
                      .eq(1)
        var INCLU_EXCLU = inclusionRegions.rename('inclu').addBands(exclusionRegions.rename('exclu')).addBands(no_detecRegions.rename('no_detec'));
                           
      return INCLU_EXCLU.toUint8()
        }

var classArea = inclus_exclu(inclusionSHP, exclusionSHP, no_detecSHP);

Map.addLayer(inclusionSHP.draw({color: '000fff', pointRadius: 5, strokeWidth: 2}),{},'Inclusion', false)
Map.addLayer(exclusionSHP.draw({color: 'ff0000', pointRadius: 5, strokeWidth: 2}),{},'Exclusion', false)
Map.addLayer(no_detecSHP.draw({color: '00ff0f', pointRadius: 5, strokeWidth: 2}),{},'No detectado', false)

// --------------------------------------------------------------------------------------------------------------------------   
// Mosaico
var modules = require('users/mapbiomasperu/mapbiomas-water:collection-2/modules/mosaic_costa_andes_amazonia-alta');
var get_Collection =modules.get_Collection2;
var Collection_all = get_Collection(pais,80, years);
    

// --------------------------------------------------------------------------------------------------------------------------   
// Inicio del REMAP

for (var i=0; i<years.length; i++) {
  
  var year = years[i];

  // Mosaico

  var start = ee.Date(String(year) + '-01-01');
  var end = start.advance(1, 'year');
  
  var CollectionYear = Collection_all.filterDate(start, end)
  Map.addLayer(CollectionYear.median(),{"bands":["swir1","nir","red"],"min":200,"max":4000},'mosaic'+'-'+year,false);
  
  // Image
  
  var image = imageCollection.filter(ee.Filter.eq("year",year)).mosaic()
  
  var water = image.gte(1).and(image.lte(3))
  
  var shade_mask = CollectionYear.median().select("shade").gte(70)
  
  var water_img = image.where(water.and(classArea.select('exclu').eq(1)),10)
                       .where(classArea.select('inclu').eq(1),image)
                       .where(shade_mask.and(classArea.select('no_detec').eq(1)),3)
                       
  water_img = water_img.set("year", year)
                       .set('version', 1)
                       .set('country', "PERU")
  
  Map.addLayer(image.select(month).gte(1).selfMask().and(image.select(month).lte(3).selfMask()),{"palette":"blue"},'clasif-filtro-'+ year +'-'+month,false); 
  Map.addLayer(water_img.select(month).gte(1).selfMask().and(water_img.select(month).lte(3).selfMask()),{"palette":"blue"},'clasif-remap-'+ year +'-'+month,false); 
  
  Export.image.toAsset({
    image: water_img, 
    description: 'water_remap_' + year + '_1', 
    assetId: 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/05-remap-01/water_remap_' + year + '_1',
    region: pais.geometry().bounds(), 
    scale: 30,
    pyramidingPolicy: {
        '.default': 'mode'
    },
    maxPixels: 1e13
  });                     
}                       