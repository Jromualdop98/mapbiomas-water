var paisName = 'Perú'; // Ecuador, Perú, Bolivia, Venezuela, Colombia, Suriname, Guiana Francesa, Guyana  
var paisName1 = 'Perú'

var imput_imgColl = '02-mask-02'

var namecountry = paisName.replace('ú', 'u')
var paises = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4");
var pais = paises.filter(ee.Filter.eq('pais', paisName1));  



var  imageVisParam = {"opacity":1,"bands":["w_1_2"],"min":1,"max":9,"palette":['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00']};

var y_start = 1985 // no cambiar usar el for para dividir tareas
var y_end = 2024   // no cambiar

var years = ee.List.sequence(y_start,y_end).getInfo()
//var year = 2022
var viz_month = 'w_6'

//var years_exclude = [1985, 1993, 1994, 1995, 1998, 2008, 2011, 2017];
var years_exclude = [1985,1990, 1993, 1994, 1995, 2000];
// print(ee.List(years_exclude).contains(1985))

var MaskRegions = ee.Image("projects/mapbiomas-raisg/MAPBIOMAS-WATER/COLECCION2/PERU/DATOS_AUXILIARES/RASTERS/regiones_agua_c2")
var MaskRegions_sel = MaskRegions.updateMask(MaskRegions.eq(1326).or(MaskRegions.eq(1327))).gt(0).multiply(5)  // 1322 es amazonia baja en el Perú
Map.addLayer(MaskRegions_sel)


for (var i=36 ;i<40; i++) {   //38
  var year = years[i];
  
  
  var y_window = ee.List(ee.Array([0,1,2,3,4]).add(ee.Algorithms.If(
      ee.Number(year).gt(y_end - 2),
      ee.Number(y_end - year - 4).add(year),
      ee.Number(y_start - year).max(-2).add(year)))).getInfo()
      
   print(y_window)    
  // var img =           ee.Image('projects/mapbiomas-raisg/PRODUCTOS/AGUA/'+ namecountry.toUpperCase() +'/COLECCION1/POSTPROCESSING/' + imput_imgColl + '/water-gap-' + y_window[0])               
  //           .addBands(ee.Image('projects/mapbiomas-raisg/PRODUCTOS/AGUA/'+ namecountry.toUpperCase() +'/COLECCION1/POSTPROCESSING/' + imput_imgColl + '/water-gap-' + y_window[1]))               
  //           .addBands(ee.Image('projects/mapbiomas-raisg/PRODUCTOS/AGUA/'+ namecountry.toUpperCase() +'/COLECCION1/POSTPROCESSING/' + imput_imgColl + '/water-gap-' + y_window[2]))              
  //           .addBands(ee.Image('projects/mapbiomas-raisg/PRODUCTOS/AGUA/'+ namecountry.toUpperCase() +'/COLECCION1/POSTPROCESSING/' + imput_imgColl + '/water-gap-' + y_window[3]))               
  //           .addBands(ee.Image('projects/mapbiomas-raisg/PRODUCTOS/AGUA/'+ namecountry.toUpperCase() +'/COLECCION1/POSTPROCESSING/' + imput_imgColl + '/water-gap-' + y_window[4]))               

  var img = ee.Image([]).select([]);
    y_window.forEach(function(yeari){
      
      var waterYear = ee.Image('projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/02-mask-01/water_' + yeari + "_1");
      // Map.addLayer(waterYear,{"min":1,"max":9,'bands':viz_month,"palette":['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00']},'waterYear'+yeari, false)                       
      waterYear = ee.Algorithms.If(ee.List(years_exclude).contains(yeari), waterYear.blend(MaskRegions_sel), waterYear);
      waterYear = ee.Image(waterYear);
      // Map.addLayer(waterYear,{"min":1,"max":9,'bands':viz_month,"palette":['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00']},'waterYear_ajus'+yeari, false)  
      img = img.addBands(waterYear);
  })


  // print ("first img", img)
  //Map.addLayer(img, imageVisParam,'input')
  
  var n_bands = img.bandNames().size(); 
  var bands_size = ee.List.sequence(1, n_bands, 1);
  
  var bands = bands_size.map(function(index){ 
    return ee.String('w_').cat(index).slice(0,-2);
  });
  
  //collection = collection.toBands().rename(bands);
  
  img = img.rename(bands)
  
  //print('img rename',img)
  
  var water = img
  // no hacer remap
  //var water = bands_size.map(function(month){
  //     var water_remapped = collection.select(ee.String('w_').cat(month).slice(0,-2)).remap([0,1,2,3,4], [0,1,1,0,2]);
  //     return water_remapped;
  //});
  //
  //water = ee.ImageCollection(water).toBands().rename(bands);
  
  //Map.addLayer(water.select(0).mask(water.select(0).neq(5)))
  
  // ----------------------------------------------------------------------
  
  var ListMonths = ee.List.sequence(1, n_bands, 1);
  
  if (year - y_start == 0 ){
    var process_block = ListMonths.slice(0,12)
  } else { 
    if (year - y_start == 1 ){
      var process_block = ListMonths.slice(12,24)
    } else {
      if (y_end - year == 1){       
        var process_block = ListMonths.slice(36,48)
      }else {
        if (y_end - year == 0){       
          var process_block = ListMonths.slice(48,60)
        }else {
          var process_block = ListMonths.slice(24,36)
        }  
      }
    }    
  }
  // print('process_block',process_block)
  
  var output = process_block.map(function(month) {
    
    var actual = water.select(ee.String('w_').cat(month).slice(0,-2))
                .updateMask(water.select(ee.String('w_').cat(month).slice(0,-2)).neq(5));
    
    var list_prev = ListMonths.slice(0, ee.Number(month).subtract(1)).reverse();
    var list_next = ListMonths.slice(month, n_bands);
    
    var z_loop = list_next.zip(list_prev);
    
    var list_month_gap  = ee.List (
    ee.Algorithms.If(
    ee.Number (list_next.size()).gt(list_prev.size()),
    ee.List(z_loop.flatten().cat(list_next).distinct()),
    ee.List(z_loop.flatten().cat(list_prev).distinct())
    ));
    
    
    var z_size = list_month_gap.size();
    
    var forLoop2 = ee.List.sequence (0, z_size.subtract(1),1).map(function(i) {
      var m_next = list_month_gap.get(i);
      var next = water.select(ee.String('w_').cat(m_next).slice(0,-2))
                      // .updateMask(water.select(ee.String('w_').cat(m_next).slice(0,-2)).neq(5));
                      .updateMask(water.select(ee.String('w_').cat(m_next).slice(0,-2)).neq(5).and(water.select(ee.String('w_').cat(m_next).slice(0,-2)).neq(3)));
      return next.rename("w").set("w", ee.Number(i).add(1));
    });
    
    forLoop2 = ee.ImageCollection(forLoop2);
    
    return ee.ImageCollection.fromImages([actual.rename("w").set("w", ee.Number(0))]).merge(forLoop2).sort("w", false).mosaic();
    
  });
  
  // ----------------------------------------------------------------------
  //print('forLoop1',forLoop1)
  
  var bNames = function(prefix){return ee.List.sequence(1,12,1).map(function(i){ return ee.String(prefix).cat(ee.String(i).slice(0,-2))})}
  output = ee.ImageCollection(output).toBands().rename(bNames('w_'))
  // print('output',output)
   
  output = output.set('year',year)
  
  var  imageVisParam1 = {"min":1,"max":9,'bands':viz_month,"palette":['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00']};
  
  Export.image.toAsset({
    image: output, 
    description: 'water_gap_' + year + '_' + namecountry, 
    assetId: 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING/03-gap-01/water-gap-' + year, 
    region: pais.geometry().bounds(), 
    scale: 30,
    pyramidingPolicy: {
        '.default': 'mode'
    },
    maxPixels: 1e13
  });
  
  Map.addLayer(img.select(ee.List(ee.Array(process_block).subtract(1).toByte()).getInfo()).rename(bNames('w_')),imageVisParam1,'imput ' + viz_month + ' '  + year, false)
  Map.addLayer(output,imageVisParam1,'output ' + viz_month + ' '  + year, false)  
  
  //return
} 