// Map002_month_probabilty_v2 

var pais_name = 'Peru'
var years = ee.List.sequence(2019,2024).getInfo()
// var years = [ 
//             //1990,2005,
//             2022
//             ];
var regionId = [1323]  // NOTA: para exportar solo 1 region
var cloud_cover = 70; 
var version = 1  // exportar
var asset_name = 'clasificacion-02'// para exportar

var month = 12;   // visualizacion 

var Paleta = 'pal-1' // pal-1 - paleta original  /  pal-2 - nueva propuesta de paleta  

// Paleta de colores
var pal ={
  'pal-1':['0000ff','009900','009900','ffffff','000000','ff0000','ff0000','c6c6c6','ffff00'],
  'pal-2':['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00'],
}
var vis_detec = pal[Paleta]

var paramfuzzy = {
  shade_min : 70, //70
  shade_max : 80,   //80
  
  soil_min : 0, 
  soil_max : 8,
  
  gv_soil_min : 10, 
  gv_soil_max : 20,
  
  gv_min : 3, 
  gv_max : 13,

  soil_asc_min : 3, 
  soil_asc_max : 8,
  
  soil_desc_min : 15, 
  soil_desc_max : 20,
  
  cloud_desc_min : 8, 
  cloud_desc_max : 15,
  
  cloud_asc_min : 0,
  cloud_asc_max : 3,
}

var paramClasif = {
  fill_gap_month: 0.5,  //0.4
  fill_gap_year: 0.7,   //0.7
  
  slppost2_corte: 25,
  p_img_month_gt: 0.6,
  p_img_month_lte: 0.6,
  
  //remap de agua en pendiente
  slope_gte: 20,
}


var vis = { // Visualizacion solo un grid 
      Map_addLayer: false,
      listbandMonth: ['w_'+month]
      // listbandMonth: [  // Visualizacion de meses
      //               'w_1',
      //               'w_6',
      //               // 'w_3','w_4',
      //               // 'w_5','w_6',
      //               // 'w_7','w_8',
      //               // 'w_9','w_10',
      //               // 'w_11','w_12'
      //               ]
  }

var modules = require('users/mapbiomasperu/mapbiomas-water:collection-2/modules/mosaic_costa_andes_amazonia-alta');  
//var modules = require('users/jromualdoibc/testeos-mbagua:coleccion-2/module-mosaic_costa');
//var modules = require('users/mapbiomasperu/mapbiomas-water:collection-1/modules/mosaic_andes_costa_amazonia-alta');

var regionVectorPath = "projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/VECTORES/regiones_agua_c2";
var regionRasterPath = "projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/RASTERS/regiones_agua_c2";

var region = ee.FeatureCollection(regionVectorPath)//.filterMetadata("id_region", "equals", regionId);
               .filter(ee.Filter.inList("id_region",regionId));

var regionMask = ee.Image(regionRasterPath).eq(regionId).selfMask();
regionMask = regionMask.reduce(ee.Reducer.allNonZero())
Map.addLayer(regionMask)

//// Otras capas 
var slppost2 = ee.Image("projects/mapbiomas-raisg/MOSAICOS/slppost2_30_v3");
var shademask2_v3 = ee.Image("projects/mapbiomas-raisg/MOSAICOS/shademask2_v3");
var Terrain = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(Terrain);
var clasif_pais = ee.Image('projects/mapbiomas-raisg/MAPBIOMAS-PERU/COLECCION2/INTEGRACION/mapbiomas_peru_collection2_integration_v1')
clasif_pais = clasif_pais.addBands(clasif_pais.select('classification_2022').rename('classification_2023'))

var jrc = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory")
            .filter(ee.Filter.inList('year',years))
            .filter(ee.Filter.inList('month',[month]))
jrc = jrc.first().select('water').eq(2).selfMask()


// Calculos probabilidad
var shade_Fit = ee.Dictionary(ee.List([[paramfuzzy.shade_min,0],[paramfuzzy.shade_max,1]]).reduce(ee.Reducer.linearFit()));

var soil_Fit = ee.Dictionary(ee.List([[paramfuzzy.soil_min,1],[paramfuzzy.soil_max,0]]).reduce(ee.Reducer.linearFit()));
var gv_soil_Fit = ee.Dictionary(ee.List([[paramfuzzy.gv_soil_min,1],[paramfuzzy.gv_soil_max,0]]).reduce(ee.Reducer.linearFit()));
var gv_Fit = ee.Dictionary(ee.List([[paramfuzzy.gv_min,1],[paramfuzzy.gv_max,0]]).reduce(ee.Reducer.linearFit()));
var soil_asc_Fit = ee.Dictionary(ee.List([[paramfuzzy.soil_asc_min,0],[paramfuzzy.soil_asc_max,1]]).reduce(ee.Reducer.linearFit()));
var soil_desc_Fit = ee.Dictionary(ee.List([[paramfuzzy.soil_desc_min,1],[paramfuzzy.soil_desc_max,0]]).reduce(ee.Reducer.linearFit()));

var cloud_asc_Fit = ee.Dictionary(ee.List([[paramfuzzy.cloud_asc_min,0],[paramfuzzy.cloud_asc_max,1]]).reduce(ee.Reducer.linearFit()));
var cloud_desc_Fit = ee.Dictionary(ee.List([[paramfuzzy.cloud_desc_min,1],[paramfuzzy.cloud_desc_max,0]]).reduce(ee.Reducer.linearFit()));


function class_1_probs (image) {
    
    var gv_soil = image.select('gv').addBands(image.select('soil')).reduce(ee.Reducer.sum());

    var cond_1 = image.select('shade').multiply(shade_Fit.getNumber('scale')).add(shade_Fit.getNumber('offset')).clamp(0, 1);
    var cond_2 = gv_soil.multiply(ee.Number(gv_soil_Fit.get('scale'))).add(ee.Number(gv_soil_Fit.get('offset'))).clamp(0, 1);
    var cond_3 = image.select('cloud').multiply(cloud_desc_Fit.getNumber('scale')).add(cloud_desc_Fit.getNumber('offset')).clamp(0, 1)
                  .addBands(
                  image.select('cloud').multiply(cloud_asc_Fit.getNumber('scale')).add(cloud_asc_Fit.getNumber('offset')).clamp(0, 1)  
                  ).reduce(ee.Reducer.min());
    var cond_4 = image.select('gv').multiply(gv_Fit.getNumber('scale')).add(gv_Fit.getNumber('offset')).clamp(0, 1);
    var cond_5 = image.select('soil').multiply(soil_Fit.getNumber('scale')).add(soil_Fit.getNumber('offset')).clamp(0, 1);
    // var cond_5 = image.select('soil').multiply(soil_desc_Fit.getNumber('scale')).add(soil_desc_Fit.getNumber('offset')).clamp(0, 1)
    //               .addBands(
    //               image.select('soil').multiply(soil_asc_Fit.getNumber('scale')).add(soil_asc_Fit.getNumber('offset')).clamp(0, 1)  
    //               ).reduce(ee.Reducer.min());

    var image_prob = cond_1.multiply(1).addBands(cond_4.multiply(1))//.addBands(cond_3.multiply(1)) //.addBands(cond_3)
                          .reduce(ee.Reducer.mean()).rename('prob');

    image_prob = image_prob.where(image.select('soil').gt(15),0)
    image_prob = image_prob.where(image.select('snow').gt(75),0)
    // image_prob = image_prob.where(image.select('gv').gt(30),0)
  
    return image_prob;

  }


var get_Collection = modules.get_Collection2;
var Collection = get_Collection(region,cloud_cover,years);

// var get_Collection = modules.get_Collection_new;
// var Collection = get_Collection(region,cloud_cover,70,years);

// -------------------------------------------------------------------------------------
// water func

var water_y_m_func = function (year, moving_window,collection) {
  
  var p_img_month = p_img_month_func(year, moving_window,collection);
  var p_year = p_year_func(year,collection);
  var p_month = p_month_func(year, moving_window,collection);
  
  var fill_gap = ee.Algorithms.If(p_year.bandNames().length().eq(1), 
                                  ee.Algorithms.If(p_month.bandNames().length().eq(1),
                                          p_month.gte(paramClasif.fill_gap_month).and(p_year.gte(paramClasif.fill_gap_year)).selfMask(),
                                          p_year.gte(paramClasif.fill_gap_year).selfMask()), 
                                  ee.Image(5).rename("p_water").selfMask())

  var detec = ee.Image(0).where(slppost2.gt(paramClasif.slppost2_corte).and(p_img_month.gte(paramClasif.p_img_month_gt)),1)
                         .where(slppost2.lte(paramClasif.slppost2_corte).and(p_img_month.gte(paramClasif.p_img_month_lte)),1)  
                         
  var deteccao = ee.Algorithms.If(p_img_month.bandNames().length().eq(1), 
                                  detec, //0.67
                                  ee.Image(0).rename("p_water").selfMask())
 
  deteccao = ee.Image(deteccao);          

  var remv = p_year.lt(0.3).selfMask();
  
/////// Clasificacion con las clases de inclusion y exclusion en el Observado y No observado 
  var gap = ee.Image(fill_gap).mask(deteccao.unmask(0).eq(0)).selfMask().multiply(3);
  
  //
  var no_data = deteccao.add(1).unmask().eq(0).selfMask();
  // var water = no_data.multiply(5).blend(deteccao).blend(gap)//.blend(remv.multiply(7));
  var water = no_data.multiply(5).blend(deteccao).blend(gap).blend(remv.multiply(7));

  var month= moving_window
  var start = ee.Date.fromYMD(year, month, 1);
  var end = start.advance(1, 'month');
  var col = Collection.filterDate(start, end).median()
  
  // water = water.where(water.eq(0),4)
  water = ee.Algorithms.If(p_img_month.bandNames().length().eq(1), 
                                  water.where(p_img_month.gte(0).and(water.eq(0)),4)
                                       .where(p_img_month.unmask().eq(0).and(water.eq(0)),5)
                                  ,
                                  water.selfMask());

  water = ee.Image(water);
  
  water = ee.Algorithms.If(col.bandNames().length().gt(0), 
                          water.where(col.select(0).and(water.eq(3)),2),
                          water)
  water = ee.Image(water)     
  
  water = ee.Algorithms.If(col.bandNames().length().gt(0), 
                          water.where(col.select(0).and(water.eq(7)),6),
                          water)
  water = ee.Image(water)
  
  water = water.where(water.eq(1).or(water.eq(2)).or(water.eq(3)).and(shademask2_v3.eq(1)),8)
               .where(water.eq(1).or(water.eq(2)).or(water.eq(3)).and(slope.gte(paramClasif.slope_gte)),9)


  return {'water':water,
          'p_img_month':p_img_month} ;
};


var vis_image = {
   opacity: 1,
   bands: ['swir1', 'nir', 'red'],
   gain: [0.08, 0.06, 0.2],
   gamma: 0.65
 };

for (var i=0; i<years.length; i++) {
  var year = years[i];
  
  var month_name = ['w_1','w_2', 'w_3','w_4','w_5','w_6','w_7','w_8','w_9','w_10','w_11', 'w_12']
  var water_y = ee.Image().select([])
  var water_p_img_month = ee.Image().select([])
  
  month_name.forEach(function(name){
          var num_month = ee.Number.parse((name).split('_')[1]);
          water_y = water_y.addBands(water_y_m_func(year, num_month,Collection).water.rename(name))
          water_p_img_month = water_p_img_month.addBands(water_y_m_func(year, num_month,Collection).p_img_month.rename(name))
        })
  
  // print('water_y',water_y)
  // print('water_p_img_month',water_p_img_month)
  
  var image = water_y.updateMask(regionMask)
    .set('year', year)
    .set('region', regionId)
    .set('version', version)
    .set('grid_name', '')
    .set('pais', pais_name)
    
  var prob = water_p_img_month.updateMask(regionMask)

  if(vis.Map_addLayer){
  vis.listbandMonth.forEach(function(bandMonth){
      var month= parseInt(bandMonth.split('_')[1])
      var start = ee.Date.fromYMD(year, month, 1);
      var end = start.advance(1, 'month');
      
        Map.addLayer(Collection.filterBounds(region).filterDate(start, end).median().updateMask(regionMask),vis_image,'mosaic-2: '+year+'-'+month,false);
        Map.addLayer(Collection.filterBounds(region).filterDate(start, end).median().updateMask(regionMask),{"bands":["swir1","nir","red"],"min":200,"max":4000},'mosaic: '+year+'-'+month,false);
        Map.addLayer(prob.select(bandMonth),{"min":0,"max":0.8,"palette":['ff451b','ffc218','fff80c','08ffe8','042eff'] },'prob-'+bandMonth,false);
        Map.addLayer(image.select(bandMonth),{"min":1,"max":9,"palette":vis_detec},'clasif-'+bandMonth,false); 
        
  });
  }
  
  var img_input_freq = image.gte(1).and(image.lte(3)).selfMask()
                            .reduce(ee.Reducer.sum());
  
  var img_input = img_input_freq.gte(6).selfMask();
  
  var colorRamp = ['ffffff','02ffe8','0417ff','000da7'];
  
  if(vis.Map_addLayer){
  Map.addLayer (img_input_freq, {palette: colorRamp, min:0, max:12}, 'freq',false);
  Map.addLayer (img_input, {palette: 'blue'}, 'annual',false)
  }
  
  
  Export.image.toAsset({
      image: image.byte(), 
      description: 'pilot_' + year + '_' + regionId + '_' + version, 
      assetId: 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/PROCESSING/' +asset_name+'/class_water_' + year + '_' + regionId + '_' + version,
      region: region.geometry().bounds(),
      scale: 30, 
      pyramidingPolicy: {
      '.default': 'mode'
    },
      maxPixels: 1e13
  });
}

var clasif_pais_agua = clasif_pais.select('classification_'+years).eq(33).selfMask()
var clasif_pais_glaciar = clasif_pais.select('classification_'+years).eq(34).selfMask()
Map.addLayer(clasif_pais_agua,{palette:'ff0af9'},'Col1 Pais - Agua - '+years, false)
Map.addLayer(clasif_pais_glaciar,{palette:'f77fff'},'Col1 Pais - Glaciar - '+years, false)

Map.addLayer(jrc.clip(region),{palette:['magenta']},'Global surface water: '+year+'-'+month,false)
Map.addLayer(Terrain,{},'Altitude',false)
Map.addLayer(slope.gte(25).selfMask(),{palette:'black'},'slope>25',false)
Map.addLayer(slope.gte(20).selfMask(),{palette:'black'},'slope>20',false)
Map.addLayer(slope,{palette:'black'},'slope',false)
Map.addLayer(shademask2_v3.selfMask(),{palette:'aeaeae'},'shademask2_v3',false)
Map.addLayer(slppost2,{"min":0,"max":100,"palette":["0617ff","108fff","16fff6","14ff33","cdff12","f9ff0c","ffc416","ff0000"]},'slppost2',false)
Map.addLayer(region.style({fillColor:'00000000'}), {}, 'region');

 
if(vis.Map_addLayer){

/* Proción de código para adicionar una leyenda
*/
  var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
  
});
 
var legendTitle = ui.Label({
  value: 'Leyenda',
  style: {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
 
legend.add(legendTitle);
var texinfo = ui.Label({
  value: 'Clasificación de agua',
  style: {
    //fontWeight: 'bold',
    fontSize: '10px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
legend.add(texinfo);

var makeRow = function(color, name) {
       var colorBox = ui.Label({ 
        style: {
          backgroundColor: '#' + color,
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
 
var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};

var Elemento =[
  [vis_detec[0],'C1-Agua detectada'],
  [vis_detec[1],'C2-Agua Incluida obs'],
  [vis_detec[2],'C3-Agua Incluida no obs'],
  [vis_detec[3],'C4-No Agua'],
  [vis_detec[4],'C5-No observado'],
  [vis_detec[5],'C6-Exclusión obs'],
  [vis_detec[6],'C7-Exclusión no obs'],
  [vis_detec[7],'C8-Agua en sombra'],
  [vis_detec[8],'C9-Agua en pendiente']
   ]
  
Elemento.forEach(function(ele){
  legend.add(makeRow(ele[0], ele[1]))
})
Map.add(legend);
}
  



//================= Funciones ================

//probabilidade do mês
function p_img_month_func (year, moving_window, processed_col) {

  var start = ee.Date.fromYMD(year, moving_window, 1);
  var end = start.advance(1, 'month');

  var imgs_prob = processed_col
                  .filterDate(start, end)
                  // .median()
                  // .map(cloudScore)
                  // .map(sma_estimated)
                  .map(class_1_probs);
  
  //var prob_class_1 = imgs_prob.median();
  //var prob_class_1 = class_1_probs(imgs_prob);
  var prob_class_1 = ee.Algorithms.If(ee.Algorithms.IsEqual(imgs_prob.size().gte(1), 1), 
                                               imgs_prob.median(), 
                                                    ee.Image(0).rename('p_water').selfMask())
                                                    
  //return prob_class_1.rename('p_water');
  return ee.Image(prob_class_1).rename('p_water');
};

function p_year_func(year, processed_col) {
  
  var water_year_month = function (ano, mes,collection) {
  
  var start = ee.Date.fromYMD(ano, mes, 1);
  var end = start.advance(1, 'month');

  var imgs_prob = collection
    .filterDate(start, end)
    //.median()
    // .map(cloudScore)
    // .map(sma_estimated)
    .map(class_1_probs);
  
  //var prob_class_1 = imgs_prob.median();
  //var prob_class_1 = class_1_probs(imgs_prob);
  var prob_class_1 = ee.Algorithms.If(ee.Algorithms.IsEqual(imgs_prob.size().gte(1), 1), 
                                               imgs_prob.median(), 
                                                    ee.Image(0).rename('prob').selfMask())
                                                    
  
  return ee.Image(prob_class_1);
  //return prob_class_1;
  };
  
  var annual_freq = water_year_month(year, 1,processed_col)
    .addBands(water_year_month(year, 2,processed_col))
    .addBands(water_year_month(year, 3,processed_col))
    .addBands(water_year_month(year, 4,processed_col))
    .addBands(water_year_month(year, 5,processed_col))
    .addBands(water_year_month(year, 6,processed_col))
    .addBands(water_year_month(year, 7,processed_col))
    .addBands(water_year_month(year, 8,processed_col))
    .addBands(water_year_month(year, 9,processed_col))
    .addBands(water_year_month(year, 10,processed_col))
    .addBands(water_year_month(year, 11,processed_col))
    .addBands(water_year_month(year, 12,processed_col))
    .reduce(ee.Reducer.mean());

  return annual_freq.rename('p_year');
};

//decendial
function p_month_func(year, moving_window,processed_col) {

var water_year_month = function (ano, mes) {

  var start = ee.Date.fromYMD(ano, mes, 1);
  var end = start.advance(1, 'month');

  var imgs_prob = processed_col
                   .filterDate(start, end)
                   //.median()
                  // .map(cloudScore)
                  // .map(sma_estimated)
                  .map(class_1_probs);
    
   //var prob_class_1 = imgs_prob.median();  
   // var prob_class_1 = class_1_probs(imgs_prob);
  var prob_class_1 = ee.Algorithms.If(ee.Algorithms.IsEqual(imgs_prob.size().gte(1), 1), 
                                               imgs_prob.median(), 
                                                    ee.Image(0).rename('prob').selfMask())
                                                    
   return ee.Image(prob_class_1);
   //return prob_class_1;
};

var year_5 = ee.Number(year).subtract(5);
var year_4 = ee.Number(year).subtract(4);
var year_3 = ee.Number(year).subtract(3);
var year_2 = ee.Number(year).subtract(2);
var year_1 = ee.Number(year).subtract(1);

var year5 = ee.Number(year).add(5);
var year4 = ee.Number(year).add(4);
var year3 = ee.Number(year).add(3);
var year2 = ee.Number(year).add(2);
var year1 = ee.Number(year).add(1);

year5 = ee.Number(
  ee.Algorithms.If(
    year5.gte(2024),
    2024,
    year5
  ));
  
year4 = ee.Number(
  ee.Algorithms.If(
    year4.gte(2024),
    2024,
    year4
  ));
  
year3 = ee.Number(
  ee.Algorithms.If(
    year3.gte(2024),
    2024,
    year3
  ));
  
year2 = ee.Number(
  ee.Algorithms.If(
    year2.gte(2024),
    2024,
    year2
  ));
  
year1 = ee.Number(
  ee.Algorithms.If(
    year1.gte(2024),
    2024,
    year1
  ));


year_5 = ee.Number(
  ee.Algorithms.If(
    year_5.lte(1985),
    1985,
    year_5
  ));
  
year_4 = ee.Number(
  ee.Algorithms.If(
    year_4.lte(1985),
    1985,
    year_4
  ));
  
year_3 = ee.Number(
  ee.Algorithms.If(
    year_3.lte(1985),
    1985,
    year_3
  ));
  
year_2 = ee.Number(
  ee.Algorithms.If(
    year_2.lte(1985),
    1985,
    year_2
  ));
  
year_1 = ee.Number(
  ee.Algorithms.If(
    year_1.lte(1985),
    1985,
    year_1
  ));


var month_freq = water_year_month(year_5, moving_window)
  .addBands(water_year_month(year_4, moving_window))
  .addBands(water_year_month(year_3, moving_window))
  .addBands(water_year_month(year_2, moving_window))
  .addBands(water_year_month(year_1, moving_window))
  .addBands(water_year_month(year, moving_window))
  .addBands(water_year_month(year1, moving_window))
  .addBands(water_year_month(year2, moving_window))
  .addBands(water_year_month(year3, moving_window))
  .addBands(water_year_month(year4, moving_window))
  .addBands(water_year_month(year5, moving_window))
  .reduce(ee.Reducer.mean());

return month_freq.rename('p_month');
};