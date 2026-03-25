/*
*
* CRIA AS QUADRICULAS -------------------------------------------------------------------------------------------------------------------------------------
*
*/

var paisName = 'Peru';
var versionGrids = '01'
var pais = ee.FeatureCollection("projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/paises-4")
           .filter(ee.Filter.eq("name", "Perú"));

var idBigGrid = "projects/mapbiomas-raisg/PRODUCTOS/AGUA/DATOS_AUXILIARES/TEMP/bigGrids_" + paisName;
var grid = ee.FeatureCollection(idBigGrid);
var geometry = grid.union();

var lonLat = ee.Image.pixelLonLat();

var lonGrid = lonLat
  .select('longitude')
  .multiply(10000000)
  .toInt();

var latGrid = lonLat
  .select('latitude')
  .multiply(10000000)
  .toInt();

var grid = lonGrid
  .multiply(latGrid)
  .reduceToVectors({
    geometry: geometry,
    scale: 30000,
    geometryType: 'polygon',
  });


grid = grid.filterBounds(pais);

/*
*
* MAPAS DE FREQUÊNCIA -------------------------------------------------------------------------------------------------------------------------------------
*
*/

// para ecuador
var collection = ee.ImageCollection('projects/mapbiomas-peru/assets/WATER/COLLECTION-3/POST-PROCESSING-V2/04-filtro-espacial-01')
                    .filter("year >= 2000")
                .map(function(image){
                      return image.clip(grid);
                })
// para guiana
// var collection = ee.ImageCollection('projects/mapbiomas-raisg/PRODUCTOS/AGUA/GUYANA/COLECCION1/POSTPROCESSING/02-gap-04')
//                     .filter("year >= 2000")
//                     .filter("year < 2013")
//                     .merge(ee.ImageCollection("projects/mapbiomas-raisg/PRODUCTOS/AGUA/GUYANA/COLECCION1/POSTPROCESSING/02-gap-05"))
//                     .filter("year >= 2000")
//                 .map(function(image){
//                       return image.clip(grid);
//                 })
                .map(function(image){
                  var yearGet = ee.Number(image.getNumber("year"));
                  return image.lte(3).selfMask().byte().set("year", yearGet);
                });

var freqTotal = collection.toBands().selfMask().reduce('sum').clip(grid);
var freqTotalPercent = freqTotal.divide(collection.size().multiply(12)).multiply(100);
print(collection.size().multiply(12))
/*
*
* FUNCOES - RANDOMIZACAO E CALCULO DE AREA -------------------------------------------------------------------------------------------------------------------------------------
*
*/

var getArea = function (img, pixelValor, geom) {
  var mask = img.eq(pixelValor).selfMask();
  var dict = ee.Image.pixelArea().divide(1000000)
    .updateMask(mask)
    .reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: geom, 
      scale: 30, 
      bestEffort: true, 
      maxPixels: 1e13
    });
  return ee.Number(dict.get("area"));
};

var shuffle = function (collection, seed) {

    collection = collection.randomColumn('random', seed || 1)
        .sort('random', true)
        .map(
            function (feature) {
                var rescaled = ee.Number(feature.get('random'))
                    .multiply(1000000000)
                    .round();
                return feature.set('new_id', rescaled);
            }
        );

    var randomIdList = ee.List(
        collection.reduceColumns(ee.Reducer.toList(), ['new_id'])
            .get('list'));

    var sequentialIdList = ee.List.sequence(1, collection.size());

    var shuffled = collection.remap(randomIdList, sequentialIdList, 'new_id');

    return shuffled;
};


/*
*
* RANDOMIZACAO DOS GRIDS -------------------------------------------------------------------------------------------------------------------------------------------------------
*
*/

var gridRawRandom = shuffle(grid,2); // Ebaralha todos os grids

var listYearsRandom = ee.List.repeat(ee.List.sequence(2000,2024,1), 100).flatten().shuffle(2).slice(0,gridRawRandom.size()); // anos aleatorios de acordo com o numero de grids

var gridRandomYears = gridRawRandom.map(function(f){
  
    var id = ee.Number(f.get("new_id")).subtract(1);
    var yearGet = ee.Number(listYearsRandom.get(id));
    
    return f.set("year", yearGet);
    
}); // Atribui um ano aleatorio a um grid aleatorio 

var gridsWater = gridRandomYears.map(function(grid){
    
    var yearGet = ee.Number(grid.getNumber("year"));
    var image = collection.filter(ee.Filter.eq("year", yearGet)).first().reduce("sum").gt(0);
    var area = getArea(image, 1, grid.geometry());
    
    return grid.set("area", area);
    
}).filter("area > 0"); // filtra pelos grids com água;

var sampleGridWater = gridsWater.size().multiply(0.1).round(); // 10% dos grids com água (número)

var gridsRandom = shuffle(gridsWater,2).limit(sampleGridWater); // Escolhe 10% aleatotios dos grids com agua

print("grids geral:", gridRawRandom, "grids com agua", gridsWater, "grids com agua 10% random:", gridsRandom);

/*
*
* VISUALIZACAO DOS LAYERS  -------------------------------------------------------------------------------------------------------------------------------------------------------
*
*/

Map.addLayer(freqTotal, {palette:['black', 'red', 'white', 'blue'], min:0, max:276}, 'freq');
Map.addLayer(gridRawRandom, {}, 'total grids');
Map.addLayer(gridsWater, {}, 'grids com agua');
Map.addLayer(gridsRandom, {}, 'grids com agua 10% random');

/*
*
* EXPOPOT GRIDS --------------------------------------------------------------------------------------------------------------------------------------------------------
*
*/

Export.table.toAsset(gridsRandom, 
                      'grids-classificacion-' + paisName.toLowerCase(), 
                      'projects/mapbiomas-peru/assets/WATER/COLLECTION-3/BODY/grids-classificacion-' + paisName.toLowerCase() + '-'+ versionGrids+ '-col3'
                    );

