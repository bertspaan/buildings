Map {
  background-color: #000;
}

#buildings {
  [year<1800] {
    polygon-fill: #A50026;
  }
  [year>=1800][year<1850] {
    polygon-fill: #D73027;
  }
  [year>=1850][year<1900] {
    polygon-fill: #F46D43;
  }
  [year>=1900][year<1930] {
    polygon-fill: #FDAE61;
  }
  [year>=1930][year<1945] {
    polygon-fill: #FEE090;
  }
  [year>=1945][year<1960] {
    polygon-fill: #FFFFBF;
  }
  [year>=1960][year<1975] {
    polygon-fill: #E0F3F8;
  }
  [year>=1975][year<1985] {
     polygon-fill: #ABD9E9;
  }
  [year>=1985][year<1995] {
    polygon-fill: #74ADD1;
  }
  [year>=1995][year<2005] {
    polygon-fill: #4575B4;
  }
  [year>=2005] {
    polygon-fill: #313695;
  } 
}
