var paisName = 'Perú'; 
// var years = [2024];
var years = ee.List.sequence(2018,2024).getInfo()
// var id_region = [1313]; //  Region Andes
var version_input = 1
var version_out = 1
var cloud_cover = 70; 

var region_interes = 'Andes'

var reg_clasif = {'Amazonia_baja':[1301],
                  'Amazonia_alta':ee.List.sequence(1302,1309).getInfo(),
                  'Andes': ee.List.sequence(1310,1322).getInfo(),
                  'Costa':ee.List.sequence(1323,1337).getInfo()}

var useMask_Mapbiomas = true
var vis = { // Visualizacion solo un grid
      Map_addLayer_filtros: false,
      Map_addLayer_anual: false,
      listbandMonth: [  // Visualizacion de meses
                    // 'w_1',
                    // 'w_2',
                    // 'w_3','w_4',
                    // 'w_5',
                    'w_6',
                    // 'w_7',
                    // 'w_8',
                    // 'w_9','w_10',
                    // 'w_11',
                    // 'w_12'
                    ]
  }
  
var namecountry = paisName.replace('ú', 'u')
var paises = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4");
var grids = ee.FeatureCollection('projects/mapbiomas-raisg/PRODUCTOS/AGUA/DATOS_AUXILIARES/TEMP/bigGrids_' + namecountry);
var pais = paises.filter(ee.Filter.eq('pais', paisName));  

// --------------------------------------------------------------------------------------------------------------------------   
var modules = require('users/mapbiomasperu/mapbiomas-water:collection-2/modules/mosaic_costa_andes_amazonia-alta');

var get_Collection =modules.get_Collection2;
var get_csf =modules.csf;
var get_NDWImf =modules.NDWImf;
var get_mNDWI =modules.mNDWI;

var Collection_all = get_Collection(pais,cloud_cover, years);
// --------------------------------------------------------------------------------------------------------------------------   

var srtm = ee.Image("USGS/SRTMGL1_003");
var slopes = ee.Terrain.slope(srtm);

var threshold_freq_mean = 1.8; 
var threshold_freq_recap = 8; // 8
var threshold_srtm_mean = 30; // 20

var ndwi1, ndwi2

if (year < 2013){
  ndwi1 = 6300
  ndwi2 = 6800
}

else {
  ndwi1 = 6800
  ndwi2 = 7300
}

// --------------------------------------------------------------------------------------------------------------------------   

function list_folder_to_featColl(e) {
  var path = e.id;
  var yearPosition = ee.String (path.split('_')[4]); //75, 79 (72, 76) //74, 78          path.substring(74, 78)         
  var fc = ee.FeatureCollection(path)
  .set('year', ee.Number.parse(yearPosition));
  
  return fc; 
}

// ----------------------------------------------------------------
var regionVectorPath = "projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/VECTORES/regiones_agua_c2";
var regionRasterPath = "projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/RASTERS/regiones_agua_c2";

var region_c2 = ee.FeatureCollection(regionVectorPath)

var regionMask_c2 = ee.Image(regionRasterPath)

var maskL8 = function(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0);
  return image.updateMask(mask);
};

// --------------------------------------------------------------------------------------------------------------------------
// para el y procesar solo para la region de ineteres
var reg_filter = reg_clasif[region_interes]
print('region filtrada',reg_filter)

var Mask = regionMask_c2

var regionesMask = {'Amazonia_baja' : Mask.eq(1301).selfMask(),
                    'Amazonia_alta' : Mask.gte(1302).and(Mask.lte(1309)).selfMask(),
                    'Andes' : Mask.gte(1310).and(Mask.lte(1322)).selfMask(),
                    'Costa' : Mask.gte(1323).and(Mask.lte(1337)).selfMask(),
                   }
                     
var region_export_rast = regionesMask[region_interes]
var region_export_vect = region_c2.filter(ee.Filter.inList('id_region',reg_filter))

Map.addLayer(region_export_vect.union(1),{},'region export vector')
Map.addLayer(region_export_rast,{},'region export raster',false)


// ----------------------------------------------------------------

var mapbiomas_acum = ee.Image('projects/mapbiomas-raisg/MAPBIOMAS-PERU/COLECCION2/INTEGRACION/mapbiomas_peru_collection2_integration_v1')
mapbiomas_acum = mapbiomas_acum.addBands(mapbiomas_acum.select('classification_2022').rename('classification_2023'))
mapbiomas_acum = mapbiomas_acum.addBands(mapbiomas_acum.select('classification_2022').rename('classification_2024'))

var agua = mapbiomas_acum.eq(33).reduce('sum').gt(0).selfMask()
var suelo_desnudo = mapbiomas_acum.eq(25).reduce('sum').gt(0).selfMask()
var acuicultura = mapbiomas_acum.eq(31).reduce('sum').gt(0).selfMask()

var acumulado = agua.addBands(suelo_desnudo).addBands(acuicultura).reduce(ee.Reducer.max())
Map.addLayer(acumulado,{'palette':'#ff0000'},"Acumulado de agua",false)

// ----------------------------------------------------------------

for (var i=0; i<years.length; i++) {
  
  var year = years[i];
  var start = String(year) + '-01-01';
  var end = String(year) + '-12-31';
  
  if (year < 2013){
    
     var CollectionYear = Collection_all.filterDate(start, end)
                                        .map(get_csf)
                                        .map(get_NDWImf)
                                        .map(get_mNDWI);
                                      
      var ndwi_mcfeeters_year = CollectionYear.select('ndwi_mcfeeters').median()//.clip(geometry);
      var mndwi_year = CollectionYear.select('mndwi').median()//.clip(geometry);
  }
  
  else {
      
      var CollectionYear2 = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
                            .filterDate(start, end)
                            .map(maskL8)
                            .median();

      var ndwi_mcfeeters_year = CollectionYear2.normalizedDifference(["B3", "B5"]).add(1).multiply(10000)//.clip(geometry);
      var mndwi_year = CollectionYear2.normalizedDifference(["B3", "B6"]).add(1).multiply(10000)//.clip(geometry);
      
      var CollectionYear = Collection_all.filterDate(start, end)
                                        .map(get_csf)
                                        .map(get_NDWImf)
                                        .map(get_mNDWI);
  }
  
  var csf_year = CollectionYear.select('csf').median()//.clip(geometry);
  var shade_year = CollectionYear.select('shade').median();
  var soil_year = CollectionYear.select('soil').median();
  
  var vis_image = {
    opacity: 1,
    bands: ['swir1', 'nir', 'red'],
    gain: [0.08, 0.06, 0.2],
    gamma: 0.65
  };

  Map.addLayer(CollectionYear.median().clip(geometry), vis_image, "Mosaico anual" )
  
  // var mapbiomas = ee.Image('projects/mapbiomas-raisg/MAPBIOMAS-PERU/COLECCION2/INTEGRACION/mapbiomas_peru_collection2_integration_v1')
  var mapbiomas = ee.Image('projects/mapbiomas-peru/assets/LAND-COVER/COLLECTION3/integracion-pais/PERU-0')
  
  print()
  mapbiomas = mapbiomas//.addBands(mapbiomas.select('classification_2021').rename('classification_2022'))
                      // .addBands(mapbiomas.select('classification_2022').rename('classification_2023'))
                      // .addBands(mapbiomas.select('classification_2022').rename('classification_2024'))
                       .select('classification_'+year)
                       .selfMask()
  // ----------------------------------------------------------------------------------------------------------------------------------------------------   
  
  var folder = 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/01-VECT-02';
  
  var lista1 = ee.data.listAssets(folder)
  var listaAsset1 = lista1['assets']
  print('listaAsset2',listaAsset1)
  
  var list = listaAsset1.map(list_folder_to_featColl);
  list = ee.FeatureCollection(list).flatten().filter(ee.Filter.eq('year', year));

  if(lista1.nextPageToken !== null){
    var lista2 = ee.data.listAssets(folder, {pageToken: lista1.nextPageToken})
    var listaAsset2 = lista2['assets']
    
    var list2 = listaAsset2.map(list_folder_to_featColl);
    list2 = ee.FeatureCollection(list2).flatten().filter(ee.Filter.eq('year', year));
    list =list.merge(list2)
    
    print('listaAsset2',listaAsset2)
  }
  print('list_grid',list.size())

  var tables_merged = list
  
  if(true){
    // Listado de regiones y biggrids que se van a integrar
    
    var tableRegions = ee.List.sequence(1301,1337).getInfo()
      
    var asset = 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/PROCESSING/clasificacion-02'
    var MaskAndes = Mask.updateMask(Mask.neq(1301))  // 1301 es amazonia baja en el Perú
    var tierrasBajas = Mask.eq(1301).selfMask(); 

    var lits_imgs=[];
    var temp;
    
    tableRegions.forEach(function(ele){
      temp = ee.Image(asset+'/class_water_'+year+'_'+ele+'_1')
      lits_imgs.push(temp)
    })
    print('lits_imgs',lits_imgs)
    
    var water = ee.ImageCollection(lits_imgs)
                  .filter(ee.Filter.eq('version', version_input))
                  .mosaic().selfMask()
                  //.clip(geometry)
                  //.updateMask(regionMask_c2)
    print('water',water)
  }
  
  var freq_year = water.gte(1).and(water.lte(3)).reduce('sum').selfMask().rename('freq');  
  
  var mean_freq_img = tables_merged.reduceToImage(['mean_freq'], ee.Reducer.firstNonNull())//.updateMask(regionMask_c2);
  
  var srtm_mean_img = tables_merged.reduceToImage(['mean_srtm'], ee.Reducer.firstNonNull())//.updateMask(regionMask_c2);
  
  var ok_img = mean_freq_img.gte(threshold_freq_mean).and(srtm_mean_img.lt(threshold_srtm_mean));
  ok_img = ok_img.addBands(freq_year.gte(threshold_freq_recap).and(srtm_mean_img.lt(threshold_srtm_mean))).reduce(ee.Reducer.max());
  
  var colorRamp = ['ffffff','02ffe8','0417ff','000da7'];
  
  if(vis.Map_addLayer_year){
    Map.addLayer(csf_year.updateMask(regionMask_c2), {palette: ['ffffff','04fff4','0c2aff','001b9d'], min: 0, max:1}, 'csf year',false);
    Map.addLayer(ndwi_mcfeeters_year.updateMask(regionMask_c2), {palette: ['ffffff','04fff4','0c2aff','001b9d'], min: 3901, max:15000}, 'ndwi mcfeeters_year', false);
    Map.addLayer(mndwi_year.updateMask(regionMask_c2), {palette: ['ffffff','04fff4','0c2aff','001b9d'], min: 3901, max:15000}, 'mndwi_mcfeeters year', false);
    Map.addLayer(shade_year.updateMask(regionMask_c2), {palette: "#154360"}, 'shade > 60', false);
    Map.addLayer(slopes.updateMask(regionMask_c2),{'palette':'FF0000'}, 'Slope', false)
    Map.addLayer(freq_year.updateMask(regionMask_c2), {palette: 'FF4AFC'}, 'Frecuencia', false);
  }
  

  var months = [1,2,3,4,5,6,7,8,9,10,11,12];
  
  var water_month_col = months.map(function (month) {
    
    var water_month = water
                      .select('w_' + month);
  
    // 1° teste 
    var mask_freq = ok_img.eq(0).selfMask();
    
    
    // 2° teste 
    var detet   = water_month.eq(1).multiply(1).selfMask().where(mask_freq.eq(1), 4)
                                                          .where(csf_year.lte(0.35).or(freq_year.lte(3).and(csf_year.lte(0.5))), 4)
                                                          .where(ndwi_mcfeeters_year.lte(ndwi1).and(MaskAndes.selfMask()), 4)  //MASK andes-costa ndwi_mcfeeters_year
                                                          .where(shade_year.lte(60), 4);
                                                          
    var fil_1   = water_month.eq(2).multiply(2).selfMask().where(mask_freq.eq(1), 4)
                                                          .where(csf_year.lte(0.35).or(freq_year.lte(3).and(csf_year.lte(0.5))), 4)
                                                          .where(ndwi_mcfeeters_year.lte(ndwi2).and(MaskAndes.selfMask()), 4)  //MASK andes-costa ndwi_mcfeeters_year
                                                          .where(shade_year.lte(60), 4);
                                                          
    var fil_2   = water_month.eq(3).multiply(3).selfMask().where(mask_freq.eq(1), 4)
                                                          .where(csf_year.lte(0.35).or(freq_year.lte(3).and(csf_year.lte(0.5))), 4)
                                                          .where(ndwi_mcfeeters_year.lte(ndwi2).and(MaskAndes.selfMask()), 4)  //MASK andes-costa ndwi_mcfeeters_year
                                                          .where(shade_year.lte(60), 4);
    var water0 = detet.blend(fil_1).blend(fil_2);

    // var img_ref = water_month.mask(water_month.eq(0).or(water_month.eq(3)).or(water_month.eq(4)));
    var img_ref = water_month.mask(water_month.eq(4)
                               .or(water_month.eq(5))
                               .or(water_month.eq(6))
                               .or(water_month.eq(7))
                               .or(water_month.eq(8))
                               .or(water_month.eq(9)));

    return water0.blend(img_ref).rename('w_' + month).set('system:index', 'w_' + month);
  });
  
  
  
  
  water_month_col = ee.ImageCollection.fromImages(water_month_col);
  
  var water_img = water_month_col.toBands().select(0,1,2,3,4,5,6,7,8,9,10,11)
  .rename('w_1', 'w_2', 'w_3', 'w_4', 'w_5', 'w_6', 'w_7', 'w_8', 'w_9', 'w_10', 'w_11', 'w_12').set('year', year);
  
  water_img = water_img.updateMask(region_export_rast)
  
  var color = ['ffffff','063cff','13ff10','ff0000','000000'];
  
  print ('year ' + year, water_img);

  if(vis.Map_addLayer_filtros){
    //Map.addLayer(srtm_mean_img.lt(threshold_srtm_mean).selfMask(), {"palette":"9200ff"}, 'srtm mean img', false)
    //Map.addLayer(mean_freq_img.gte(threshold_freq_mean).selfMask(), {"palette":"ff00af"}, 'mean freq img', false)
    Map.addLayer(slopes.lt(threshold_srtm_mean).selfMask().clip(geometry),{'palette':'FF0000'}, 'Slope < 20', false)
    Map.addLayer(freq_year.gte(2).selfMask().clip(geometry), {palette: 'FF4AFC'}, 'Frecuencia > 2', false);
    Map.addLayer(csf_year.gt(0.35).selfMask().clip(geometry), {palette: "#154360"}, 'csf > 0.35', false);
    Map.addLayer(shade_year.gt(60).selfMask().clip(geometry), {palette: "#154360"}, 'shade > 60', false);
    Map.addLayer(ndwi_mcfeeters_year.gt(6300).selfMask().clip(geometry), {palette:"50A5FF" }, "ndwi mcfeeters > 7300", false); //6700
    Map.addLayer(ndwi_mcfeeters_year.gt(6800).selfMask().clip(geometry), {palette:"007CFF" }, "ndwi mcfeeters > 7800", false);  //6300
  }
  
 
  if(useMask_Mapbiomas){
    
  var bosque = mapbiomas.eq(3).selfMask().updateMask(acumulado.unmask().not())  
  var bosque_seco = mapbiomas.eq(4).selfMask().updateMask(acumulado.unmask().not()) 
  var pastizal = mapbiomas.eq(12).selfMask().updateMask(acumulado.unmask().not()) 
  var matorral = mapbiomas.eq(13).selfMask().updateMask(acumulado.unmask().not()) 
  var pasto = mapbiomas.eq(15).selfMask().updateMask(acumulado.unmask().not()) 
  var urbano = mapbiomas.eq(24).selfMask().updateMask(acumulado.unmask().not()) 
  
  var water_img2 = water_img.where((water_img.gte(1).and(water_img.lte(3))).and(bosque.eq(1)), 4)
                            .where((water_img.gte(1).and(water_img.lte(3))).and(bosque_seco.eq(1)), 4)
                            .where((water_img.gte(1).and(water_img.lte(3))).and(pastizal.eq(1)), 4) //Agropecuaria
                            .where((water_img.gte(1).and(water_img.lte(3))).and(matorral.eq(1)), 4)
                            .where((water_img.gte(1).and(water_img.lte(3))).and(pasto.eq(1)), 4)
                            .where((water_img.gte(1).and(water_img.lte(3))).and(urbano.eq(1)), 4)
  
  var water_img2_agua = water_img2.gte(1).and(water_img2.lte(3)).selfMask()
  
  var mask_mapbiomas = bosque.addBands(bosque_seco)
                             .addBands(pastizal)
                             .addBands(matorral)
                             .addBands(pasto)
                             .addBands(urbano)
                             .reduce(ee.Reducer.max())
   
   Map.addLayer(mask_mapbiomas.eq(1).selfMask().clip(geometry),{"palette":"#138D75"},'Mask mapbiomas',false);
                             
  }
  
  var water_agua = water.gte(1).and(water.lte(3)).selfMask()
  var water_img_agua = water_img.gte(1).and(water_img.lte(3)).selfMask()

    
      if(vis.Map_addLayer_anual){
        vis.listbandMonth.forEach(function(bandMonth){
        var month= parseInt(bandMonth.split('_')[1])
        var start = ee.Date.fromYMD(year, month, 1);
        var end = start.advance(1, 'month');
    
          Map.addLayer(water.select(bandMonth).clip(geometry),{"min":0,"max":4,"palette":['ffffff','0000ff','00aa00','ff0000','000000'] },'clasif-pilot-'+bandMonth,false);
          Map.addLayer(water_agua.select(bandMonth).clip(geometry),{"palette":"#0000FF" },'clasif-pilot-agua-'+bandMonth,false);
          Map.addLayer(water_img.select(bandMonth).clip(geometry),{"min":0,"max":4,"palette":['ffffff','0000ff','00aa00','ff0000','000000'] },'clasif-mask-'+bandMonth,false);
          Map.addLayer(water_img_agua.select(bandMonth).clip(geometry),{"palette":"#0000FF"},'clasif-mask-agua-'+bandMonth,false);
          Map.addLayer(water_img2.select(bandMonth).clip(geometry),{"min":0,"max":4,"palette":['ffffff','0000ff','00aa00','ff0000','000000'] },'clasif-mask-MB-'+bandMonth,false);
          Map.addLayer(water_img2_agua.select(bandMonth).clip(geometry),{"palette":"#0000FF"},'clasif-mask MB-agua-'+bandMonth,false);
        })
      }
      
    var img_input_freq = water_img.gte(1).and(water_img.lte(3)).selfMask()
                            .reduce(ee.Reducer.sum());
    
    var img_input = img_input_freq
    .gte(6)
    .selfMask();
    
    var colorRamp = ['ffffff','02ffe8','0417ff','000da7'];
    
    if(vis.Map_addLayer){
    Map.addLayer (img_input_freq, {palette: colorRamp, min:0, max:12}, 'freq',false);
    Map.addLayer (img_input, {palette: 'blue'}, 'annual',false)
    }
    
  if(useMask_Mapbiomas){
    var water_img = water_img2;
  }
  
  water_img = water_img.set('year', year)
                       .set('version', version_out)
                       .set('country', namecountry.toUpperCase())
                       .set('reg_clasif',region_interes);
  print('capa a exportar',water_img)
  
  Export.image.toAsset({
    image: water_img, 
    description: region_interes+'_'+'water_' + year + '_' + version_out, 
    assetId: 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING-V2/02-mask-01-regiones/' + region_interes+'_water_' + year + '_' + version_out, 
    region: pais.geometry().bounds(), 
    scale: 30,
    pyramidingPolicy: {
        '.default': 'mode'
    },
    maxPixels: 1e13
  });
  
}