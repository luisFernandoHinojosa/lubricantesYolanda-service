# $baseUrl = "http://localhost:3001/api/v1"

# function Test-Endpoint {
#     param ($name, $url)
#     Write-Host "Testing $name..."
#     try {
#         $get = Invoke-RestMethod -Method Get -Uri "$baseUrl/$url"
#         Write-Host "GET $name Success: $($get.status)"
        
#         $body = @{
#             nombre = "Test $name $(Get-Random)"
#             descripcion = "Description $name"
#         }
#         if ($name -eq "unidad_medidas") {
#             $body = @{
#                 nombre = "Test $name $(Get-Random)"
#                 abreviatura = "TM"
#             }
#         }
#         $json = $body | ConvertTo-Json
#         $post = Invoke-RestMethod -Method Post -Uri "$baseUrl/$url" -ContentType "application/json" -Body $json
#         Write-Host "POST $name Success: $($post.status)"
#         Write-Host "Created Data: $($post.data | ConvertTo-Json -Depth 2)"
#     } catch {
#         Write-Host "Error testing $name : $_"
#         $_.Exception.Response
#     }
# }

# Test-Endpoint "marcas" "marcas"
# Test-Endpoint "categorias" "categorias"
# Test-Endpoint "ubicacion_fisica" "ubicacion_fisica"
# Test-Endpoint "unidad_medidas" "unidad_medidas"
