Map {
  background-color: #000;
}

#pand {
  [bouwjaar<1800] {
    polygon-fill: #A50026;
  }
  [bouwjaar>=1800][bouwjaar<1850] {
    polygon-fill: #D73027;
  }
  [bouwjaar>=1850][bouwjaar<1900] {
    polygon-fill: #F46D43;
  }
  [bouwjaar>=1900][bouwjaar<1930] {
    polygon-fill: #FDAE61;
  }
  [bouwjaar>=1930][bouwjaar<1945] {
    polygon-fill: #FEE090;
  }
  [bouwjaar>=1945][bouwjaar<1960] {
    polygon-fill: #FFFFBF;
  }
  [bouwjaar>=1960][bouwjaar<1975] {
    polygon-fill: #E0F3F8;
  }
  [bouwjaar>=1975][bouwjaar<1985] {
     polygon-fill: #ABD9E9;
  }
  [bouwjaar>=1985][bouwjaar<1995] {
    polygon-fill: #74ADD1;
  }
  [bouwjaar>=1995][bouwjaar<2005] {
    polygon-fill: #4575B4;
  }
  [bouwjaar>=2005] {
    polygon-fill: #313695;
  } 
  
}


