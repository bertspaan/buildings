require 'json'

config = JSON.parse(File.read('./config.json'))

export_path = config["paths"]["export"]

Dir["#{export_path}/*.png"].each do |filename|
  if not filename.include? "thumb"
    resize_cmd = "convert #{filename} -resize 150x4000\\> #{filename.gsub(".png", "_thumb.png")}"
    puts "Resizing #{filename}..."
    system resize_cmd
  end
end

