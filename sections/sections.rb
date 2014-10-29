require 'json'
require 'rgeo/geo_json'
require 'faraday'
require 'fileutils'
require 'stringex'
require 'mini_magick'

config = JSON.parse(File.read('./config.json'))

export_path = config["paths"]["exports"]
projects_path = config["paths"]["projects"]
tilemill_path = config["paths"]["tilemill"]
script_path = File.expand_path(File.dirname(__FILE__))

formats = ["png"] # ["pdf", "png"]

arg_sections = ARGV

r = 1.8 # pixels per meter
l = 8000 # longest edge of resulting image in pixels
a = 3.0/2.0 # aspect ratio of image

convert_to_jpg = false

rgeo_factory = RGeo::Geographic.spherical_factory(:srid => 3785)

#bbox=xmin,ymin,xmax,ymax
tile_cmd = "#{tilemill_path}/index.js export buildings #{export_path}/sections/%s.%s --format=%s --width=%s --height=%s --bbox=%s --files=#{projects_path}"

#3x2
# {
#   "type": "Feature",
#   "properties": {
#     "name": ""
#   },
#   "geometry":
# },
sections = JSON.parse(File.read('./sections.json'))

Dir.chdir(tilemill_path)
sections["features"].each do |selection|

  name = selection["properties"]["name"]
  filename = name.downcase.to_ascii.gsub(/[^a-z]/, "_")

  if arg_sections.empty? or arg_sections.include? name or arg_sections.include? filename or arg_sections.include? name.downcase
    name = selection["properties"]["name"]
    filename = name.downcase.to_ascii.gsub(/[^a-z]/, "_")

    geom = RGeo::GeoJSON.decode(selection["geometry"].to_json, json_parser: :json)
    bbox = RGeo::Cartesian::BoundingBox.create_from_geometry(geom)

    bbox_str = [
      bbox.min_x(),
      bbox.min_y(),
      bbox.max_x(),
      bbox.max_y()
    ].join(",")

    sw = rgeo_factory.point(bbox.min_x(), bbox.min_y())
    se = rgeo_factory.point(bbox.max_x(), bbox.min_y())
    nw = rgeo_factory.point(bbox.min_x(), bbox.max_y())

    dx = sw.distance(se).round
    dy = sw.distance(nw).round

    puts "Rendering #{name}, #{dx / 1000} bij #{dy / 1000} km."

    formats.each { |format|
      puts tile_cmd % [filename, format, format, (r * dx).round, (r * dy).round, bbox_str]
      system tile_cmd % [filename, format, format, (r * dx).round, (r * dy).round, bbox_str]
    }

    if convert_to_jpg
      puts "Converting #{name} to jpg"
      s = (l / a).round
      image = MiniMagick::Image.open("#{export_path}/sections/#{filename}.png")
      orientation = image[:width] > image[:height] ? :landscape : :portrait
      puts "\tOrientation: #{orientation}"
      image.combine_options do |c|
        c.resize "#{l}x#{l}>"

        if orientation == :landscape
          c.crop "#{l}x#{s}+0+0"
        else
          c.crop "#{s}x#{l}+0+0"
        end

        c.gravity "center"

      end
      image.write "#{export_path}/sections/#{filename}_s.png"

      # Using MiniMagick to convert to JPG leads to 'invalid JPG' errors...
      system "convert #{export_path}/sections/#{filename}_s.png -colorspace sRGB -quality 99 #{export_path}/sections/#{filename}.jpg"
    end
  end
end

puts "Done..."
