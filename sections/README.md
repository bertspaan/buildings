# Export high-res map sections

Export all sections from `sections.json`:

`ruby sections.rb`

Export one or more sections from `sections.json`:

`ruby sections.rb amsterdam groningen`

## Ruby gems

The script requires the following gems to be installed:

		gem install rgeo
		gem install rgeo-geojson
		gem install faraday
		gem install stringex
		gem install mini_magick

## Configuration

Copy `config.example.json` to `config.json`, and change the paths to reflect your machine's configuration.
