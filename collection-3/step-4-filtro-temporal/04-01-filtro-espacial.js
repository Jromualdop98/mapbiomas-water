var years = ee.List.sequence(2016, 2020, 1).getInfo()

var min_connect_pixel = 5
var viz_month = 2

var paises = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4");
var pais = paises.filter(ee.Filter.eq('pais', 'Perú')); 

var BiomasRas = ee.Image('projects/mapbiomas-raisg/DATOS_AUXILIARES/RASTERS/clasificacion-mosaicos-4')
var regiones_filtro= BiomasRas.eq(701).or(BiomasRas.eq(703)).or(BiomasRas.eq(704)).or(BiomasRas.eq(705)).selfMask()
Map.addLayer(regiones_filtro)
var amazonia_baja = BiomasRas.eq(702)

for (var i=0; i<years.length; i++) {
  
  var year = years[i];

  var gap = ee.ImageCollection('projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING-V2/03-gap-01')
  var collection = gap
  
  var collection2 = collection.filter(ee.Filter.eq('year',year)).mosaic()
  var gap_amazonia_baja = collection2.updateMask(amazonia_baja)
  Map.addLayer(gap_amazonia_baja,{},'Gap amazonia baja',false)
  collection = collection2.updateMask(regiones_filtro)
  Map.addLayer(collection,{},'Gap regiones filtro',false)
  
  //******************FILTRO ESPACIAL SOBRE LA ITERACION******************************
    // Input clasificacion Agua IMAGE Multibanda mensual
    var clasificacionImage = collection;
  
    // Connected calculate
        // get band names list 
        var bandNames = [
                'w_1',
                'w_2',
                'w_3',
                'w_4',
                'w_5',
                'w_6',
                'w_7',
                'w_8',
                'w_9',
                'w_10',
                'w_11',
                'w_12'
                ];
                
        // add connected pixels bands
        var imageFilledConnected = clasificacionImage.addBands(
            clasificacionImage
                .connectedPixelCount(100, true)
                .rename(bandNames.map(
                    function (band) {
                        return ee.String(band).cat('_connected')
                    }
                ))
        );
    // Spatial filter first band
        var monthBandNames = 'w_1'
        var moda_w1 = imageFilledConnected.select(monthBandNames).focalMin(1, 'square', 'pixels')
        moda_w1 = moda_w1.mask(imageFilledConnected.select(monthBandNames + '_connected').lte(min_connect_pixel))
        var clasificacionImage_FS = imageFilledConnected.select(monthBandNames).blend(moda_w1)
        
    // Spatial filter all bands
        for (var i_m=0;i_m<bandNames.slice(-11).length; i_m++){  
          var monthBandName = bandNames.slice(-11)[i_m]; 
          var moda = imageFilledConnected.select(monthBandName).focalMin(1, 'square', 'pixels')
          moda = moda.mask(imageFilledConnected.select(monthBandName + '_connected').lte(min_connect_pixel))
          var class_out = imageFilledConnected.select(monthBandName).blend(moda)
          clasificacionImage_FS = clasificacionImage_FS.addBands(class_out)
        }
        
    
    // Exclusion classes
      var clases = [1,2,3];
      if(clases.length>0){
         var clasifi = ee.List([])
            clases.forEach(function(clase){
              var clasif_code =clasificacionImage.eq(clase).selfMask()
              clasifi = clasifi.add(clasificacionImage.updateMask(clasif_code).selfMask())
            })
            
            clasifi = ee.ImageCollection(clasifi)
            clasifi = clasifi.max()
            //Map.addLayer(clasifi,{},'clasific exclu_classe')
            clasificacionImage_FS = clasificacionImage_FS.blend(clasifi)
      }
  
  //************************************************
  
  clasificacionImage_FS = clasificacionImage_FS.blend(gap_amazonia_baja).set('year',year)
  print(clasificacionImage_FS)
  
  //clasificacionImage_FS = clasificacionImage_FS.set('year',year)
  
  var imageVisParam ={
    bands:"w_"+viz_month,
    min:1,
    max:9,
    palette: ['0000ff','009900','5af100','ffffff','000000','ff0000','ff60c7','c6c6c6','ffff00']
  }
  
  var clasif_agua_total = collection2.gte(1).and(collection2.lte(3))//.selfMask()
  var clasif_agua_total_fs = clasificacionImage_FS.gte(1).and(clasificacionImage_FS.lte(3)).selfMask()
  
  Map.addLayer(collection2.reproject('EPSG:4326', null, 30), imageVisParam, 'Gap-'+i+'-'+viz_month, false)
  Map.addLayer(clasificacionImage_FS.reproject('EPSG:4326', null, 30), imageVisParam, 'FS-'+i+'-'+viz_month, false)
  Map.addLayer(clasif_agua_total.selfMask().reproject('EPSG:4326', null, 30), {bands:"w_"+viz_month,palette:'0000FF'}, 'agua total-'+i+'-gap'+viz_month, false)
  Map.addLayer(clasif_agua_total_fs.selfMask().reproject('EPSG:4326', null, 30), {bands:"w_"+viz_month,palette:'0000FF'}, 'agua total-'+i+'-'+viz_month + '-fs', false)
  
  Export.image.toAsset({
    image: clasificacionImage_FS, 
    description: 'water_fs_' + year + '_Peru', 
    assetId: 'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING-V2/04-filtro-espacial-01/water-fs-' + year, 
    region: pais.geometry().bounds(), 
    scale: 30,
    pyramidingPolicy: {
        '.default': 'mode'
    },
    maxPixels: 1e13
  });
  
} 