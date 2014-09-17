require 'json'
require 'rgeo/geo_json'
require 'faraday'
require 'fileutils'
require 'stringex'

config = JSON.parse(File.read('./config.json'))

export_path = config["paths"]["exports"]
projects_path = config["paths"]["projects"]
tilemill_path = config["paths"]["tilemill"]
script_path = File.expand_path(File.dirname(__FILE__))

#formats = ["pdf", "png"]
formats = ["png"]

r = 0.16 # pixels per meter
px = 0.015 # x padding in degrees, approx 1km.
py = 0.01 # y padding in degrees, approx 1km.

rgeo_factory = RGeo::Geographic.spherical_factory(:srid => 3785)

#bbox=xmin,ymin,xmax,ymax
tile_cmd = "#{tilemill_path}/index.js export bag #{export_path}/municipalities/%s.%s --format=%s --width=%s --height=%s --bbox=%s --files=#{projects_path}"

Dir.chdir(tilemill_path)

municipalities = []
(1..7).each do |page|
  response = Faraday.get "http://api.citysdk.waag.org/admr.nl.nederland/regions?admr::admn_level=3&geom&per_page=100&page=#{page}"
  results = JSON.parse(response.body)["results"] rescue nil
  
  results.each do |municipality|
    name = municipality["name"]
    filename = name.downcase.to_ascii.gsub(/[^a-z]/, "_")
    geom = RGeo::GeoJSON.decode(municipality["geom"].to_json, :json_parser => :json)
    bbox = RGeo::Cartesian::BoundingBox.create_from_geometry(geom)

    bbox_str = [
      bbox.min_x() - px,
      bbox.min_y() - py,
      bbox.max_x() + px,
      bbox.max_y() + py
    ].join(",")
        
    sw = rgeo_factory.point(bbox.min_x() - px, bbox.min_y() - py)
    se = rgeo_factory.point(bbox.max_x() + px, bbox.min_y() - py)
    nw = rgeo_factory.point(bbox.min_x() - px, bbox.max_y() + py)
  
    dx = sw.distance(se).round
    dy = sw.distance(nw).round
  
    puts "Rendering #{name}, #{dx / 1000} bij #{dy / 1000} km." 
    
    formats.each { |format| system tile_cmd % [filename, format, format, (r * dx).round, (r * dy).round, bbox_str] }
    
    municipalities << {
      :name => name,
      :centroid => [bbox.center_x(), bbox.center_y()],
      :filename => filename
    }
  
  end

end

Dir.chdir(script_path)
File.open("municipalities.json", 'w') { |file| file.write(JSON.pretty_generate(municipalities)) }
puts "Done..."

