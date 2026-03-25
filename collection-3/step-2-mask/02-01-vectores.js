// Parametros

var years = [2024];
// var years = ee.List.sequence(1985,2023).getInfo()
var versionOut = 1  //definir version de acuerdo com cambio de regiones o del dato de entrada
var paisName = 'Perú'; 
var vis_month = 'w_1'


// Listado de los biggrid que se van a vectorizar 

var grid_names = [
  //PRIORIDAD
  //Andes y Amazonia alta
    // 'SB-18-V',
    // 'SB-18-Y',
    // 'SC-18-V',
    // 'SC-18-Y',
    // 'SC-18-Z',
    // 'SD-18-X',
    // 'SD-18-Z',
    // 'SE-18-X',
    // 'SD-18-V',
    // 'SD-19-V',
    // 'SD-19-Y',
    // 'SE-19-V',
    // 'SE-19-Y',
    // 'SC-17-X',
    // 'SC-17-Z',
    // 'SD-18-Y',
    // 'SD-19-Z',
    
    //Costa
    'SA-17-Z',
    'SB-17-V',
    'SB-17-X',
    'SB-17-Y',
    'SB-17-Z',
    
    // NO PRIORIDAD
    // Amazonia baja y pocas areas
    'SA-18-Z',
    'SB-18-X',
    'SB-18-Z',
    'SC-18-X',
    'SA-18-X',
    'SA-18-Y',
    'SA-19-Y',
    'SB-19-V',
    'SC-19-V',
    'SC-19-Y',
    'SA-18-V',
    'SC-19-Z',
    'SD-19-X',
    'SE-19-X'
  ];
  
  
// Ruta que se utilizara para la masccara de la region de andes
var namecountry = paisName.replace('ú', 'u')
var asset = 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/PROCESSING/clasificacion-01'
var MaskRegions = ee.Image("projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/RASTERS/regiones_agua_c2");
Map.addLayer(MaskRegions.randomVisualizer(),{},'Subregiones')


// Listado de regiones y biggrids que se van a integrart
var tableRegions = [
            [1301,1],
            [1302,1],
            [1303,1],
            [1304,1],
            [1305,1],
            [1306,1],
            [1307,1],
            [1308,1],
            [1309,1],
            [1310,1],
            [1311,1],
            [1312,1],
            [1313,1],
            [1314,1],
            [1315,1],
            [1316,1],
            [1317,1],
            [1318,1],
            [1319,1],
            [1320,1],
            [1321,1],
            [1322,1],
            [1323,1],
            [1324,1],
            [1325,1],
            [1326,1],
            [1327,1],
            [1328,1],
            [1329,1],
            [1330,1],
            [1331,1],
            [1332,1],
            [1333,1],
            [1334,1],
            [1335,1],
            [1336,1],
            [1337,1],
        ]

var lits_imgs=[]
var temp;

years.forEach(function(year){
lits_imgs = []

tableRegions.forEach(function(ele){
  temp = ee.Image(asset+'/class_water_'+year+'_'+ele[0]+'_'+ele[1])
  lits_imgs.push(temp)
})
print('lits_imgs',lits_imgs)

var col = ee.ImageCollection(lits_imgs).mosaic().selfMask()
print(col)


var pall = ['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00']
Map.addLayer(col,{palette:pall,min:1, max:9,bands:vis_month},'Clasificacion ' + year)

var srtm = ee.Image("USGS/SRTMGL1_003");

var paises = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4");
var pais = paises.filter(ee.Filter.eq('pais', paisName));  

Map.addLayer (pais, {}, 'limit ' + paisName,false);

var grids = ee.FeatureCollection('projects/mapbiomas-raisg/PRODUCTOS/AGUA/DATOS_AUXILIARES/TEMP/bigGrids_' + namecountry)
Map.addLayer(grids,{},'grids cartas',false)

var slppost2 = ee.Image("projects/mapbiomas-raisg/MOSAICOS/slppost2_30_v3");

var subgrids = ee.FeatureCollection('projects/mapbiomas-raisg/PRODUCTOS/AGUA/DATOS_AUXILIARES/TEMP/sub_grid_0_25_america_sul')
                .filterBounds(pais);

Map.addLayer(subgrids,{},'subgrids',false)

var slopes = ee.Terrain.slope(srtm);
var water = col.gte(1).and(col.lte(3))   //convertido a zero y uno agua/noagua

var freq_year = water.reduce('sum')
      //.blend(urban_year)
      .selfMask()
      .rename('freq');
print("freq_year", freq_year)
Map.addLayer(freq_year, {}, "freq_year")
var vec_img = freq_year.gt(0).selfMask();
print("vec_img", vec_img)
Map.addLayer(vec_img, {},"vec_img" )


for (var i=0; i< grid_names.length; i++) {
  // if (grid_names.length>i){
    var grid_name = grid_names[i];
    
    var grid = grids.filter(ee.Filter.eq('grid_name', grid_name));
    
    var subgrids_grid = subgrids
      .filterBounds(grid.first().geometry().buffer(-100))
      .filterBounds(pais); 
      
    //Map.addLayer(subgrids_grid,{},'subgrids',false)
    
    var subg 
    var vecs = subgrids_grid.map(function (sub) {
      subg = vec_img.clip(sub.geometry())
      var subg2 = ee.Algorithms.If(subg.bandNames().length().gt(0),subg.reduceToVectorsStreaming({
        geometry: sub.geometry(), 
        scale: 30, 
        maxPixels: 1e13, 
        }),ee.FeatureCollection([]))
      return ee.FeatureCollection(subg2)
    });
    
    var vecs_flattened = vecs.flatten();
    // Map.addLayer(vecs_flattened)
    
    var vecs_prop = vecs_flattened.map(function (f) {
          
          var mean_freq = freq_year.reduceRegion({
            reducer: ee.Reducer.mean(), 
            geometry: f.geometry(), 
            scale: 30, 
            bestEffort: true, 
            maxPixels: 1e13
          }).get('freq');
          
          var mean_srtm = slopes.reduceRegion({
            reducer: ee.Reducer.mean(), 
            geometry: f.geometry(), 
            scale: 30, 
            bestEffort: true, 
            maxPixels: 1e13
          }).get('slope');
          
          return f
            .set('mean_freq', mean_freq)
            .set('mean_srtm', mean_srtm)
            .set('year', year)
            .set('grid_name', grid_name)
            // .set('region',region)
            .set('versionOut',versionOut)
        });
    
    
    Export.table.toAsset({
        collection:vecs_prop,
        description:'water_objs_' + year + '_' + grid_name + '_' + versionOut,
        assetId:'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/01-VECT-01/water_objs_' + year + '_' + grid_name + '_' + versionOut,
      //maxVertices:1e13,
    })
  }  
})
